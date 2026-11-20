import express, { type Request, type Response } from "express";

/**
 * Server-side TMDB proxy mounted at /api/tmdb.
 *
 * - The read token lives only on the server; the browser never sees it.
 * - Only the endpoints the app actually uses are forwarded (no open proxy).
 * - Successful responses are cached in memory and identical in-flight requests
 *   share one upstream call, so a popular page costs one TMDB hit per TTL.
 *
 * Used by the production server (server/app.ts) and by the Vite dev server
 * (vite.config.ts), so dev and prod behave the same.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Paths the client is allowed to request (relative to /api/tmdb). */
const ALLOWED_PATHS = [
  /^\/discover\/movie$/,
  /^\/movie\/\d{1,10}$/,
  /^\/movie\/\d{1,10}\/recommendations$/,
  /^\/trending\/movie\/(day|week)$/,
  /^\/search\/movie$/,
];

const MAX_QUERY_LENGTH = 2048;
const MAX_PARAMS = 30;

export interface TmdbProxyOptions {
  /** TMDB "API Read Access Token" (v4). Missing → every request returns 503 MISSING_TMDB_TOKEN. */
  token: string | undefined;
  /** How long successful responses stay cached. Default 10 minutes. */
  ttlMs?: number;
  /** Max cached responses before the oldest are evicted. Default 500. */
  maxEntries?: number;
  /** Upstream timeout. Default 8 seconds. */
  timeoutMs?: number;
  /** Browser cache lifetime sent in Cache-Control. Default 5 minutes. */
  browserMaxAgeSec?: number;
  /** Injected for tests. */
  fetch?: typeof fetch;
  /** Injected for tests. */
  logger?: Pick<Console, "warn" | "error">;
}

interface Upstream {
  status: number;
  body: string;
  retryAfter?: string | null;
}

interface CacheEntry {
  expires: number;
  body: string;
}

export function createTmdbProxy(options: TmdbProxyOptions) {
  const {
    token,
    ttlMs = 10 * 60_000,
    maxEntries = 500,
    timeoutMs = 8_000,
    browserMaxAgeSec = 300,
    fetch: fetchImpl = globalThis.fetch,
    logger = console,
  } = options;

  const cache = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<Upstream>>();

  function cacheGet(key: string) {
    const hit = cache.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      cache.delete(key);
      return undefined;
    }
    // refresh recency (Map keeps insertion order → oldest first)
    cache.delete(key);
    cache.set(key, hit);
    return hit.body;
  }

  function cacheSet(key: string, body: string) {
    cache.set(key, { body, expires: Date.now() + ttlMs });
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  async function callUpstream(key: string): Promise<Upstream> {
    const res = await fetchImpl(TMDB_BASE + key, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text();
    return { status: res.status, body, retryAfter: res.headers.get("retry-after") };
  }

  function fetchShared(key: string) {
    let pending = inFlight.get(key);
    if (!pending) {
      pending = callUpstream(key).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return pending;
  }

  const app = express();
  app.disable("x-powered-by");

  app.use(async (req: Request, res: Response) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.set("Allow", "GET, HEAD");
      return sendError(res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported.");
    }

    const url = new URL(req.url, "http://proxy.local");
    if (!ALLOWED_PATHS.some((re) => re.test(url.pathname))) {
      return sendError(res, 404, "NOT_ALLOWED", "Unknown API route.");
    }
    if (url.search.length > MAX_QUERY_LENGTH || [...url.searchParams.keys()].length > MAX_PARAMS) {
      return sendError(res, 414, "QUERY_TOO_LONG", "Query string is too long.");
    }
    if (!token) {
      return sendError(res, 503, "MISSING_TMDB_TOKEN", "TMDB_TOKEN is not configured on the server.");
    }

    url.searchParams.sort(); // same params in any order → same cache key
    const key = url.pathname + (url.searchParams.size ? `?${url.searchParams}` : "");

    const cached = cacheGet(key);
    if (cached !== undefined) return sendJson(res, cached, "HIT", browserMaxAgeSec);

    let upstream: Upstream;
    try {
      upstream = await fetchShared(key);
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      logger.warn(`[tmdb] ${timedOut ? "timeout" : "network error"} on ${url.pathname}`, timedOut ? "" : err);
      return timedOut
        ? sendError(res, 504, "UPSTREAM_TIMEOUT", "TMDB took too long to respond.")
        : sendError(res, 502, "UPSTREAM_UNREACHABLE", "Couldn't reach TMDB.");
    }

    if (upstream.status >= 200 && upstream.status < 300) {
      cacheSet(key, upstream.body);
      return sendJson(res, upstream.body, "MISS", browserMaxAgeSec);
    }
    if (upstream.status === 404) {
      return sendError(res, 404, "NOT_FOUND", "That title doesn't exist on TMDB.");
    }
    if (upstream.status === 429) {
      res.set("Retry-After", upstream.retryAfter ?? "10");
      return sendError(res, 503, "UPSTREAM_RATE_LIMITED", "TMDB is busy. Try again shortly.");
    }
    if (upstream.status === 401 || upstream.status === 403) {
      logger.error(`[tmdb] upstream rejected the token (${upstream.status}). Check TMDB_TOKEN.`);
      return sendError(res, 502, "UPSTREAM_AUTH", "The server's TMDB credentials were rejected.");
    }
    logger.warn(`[tmdb] upstream ${upstream.status} on ${url.pathname}`);
    return sendError(res, 502, "UPSTREAM_ERROR", `TMDB returned ${upstream.status}.`);
  });

  return app;
}

function sendJson(res: Response, body: string, cacheStatus: "HIT" | "MISS", maxAge: number) {
  res
    .status(200)
    .set({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}`,
      "X-Cache": cacheStatus,
    })
    .send(body);
}

export function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).set("Cache-Control", "no-store").json({ error: { code, message } });
}
