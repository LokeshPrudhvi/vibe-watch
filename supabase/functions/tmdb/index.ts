/**
 * TMDB proxy as a Supabase Edge Function (Deno), for the phone app.
 * Same contract as the website's Express proxy (server/tmdbProxy.ts):
 *
 *   GET {SUPABASE_URL}/functions/v1/tmdb/<tmdb path>?<query>
 *
 * - The TMDB read token lives only in the function's secrets (TMDB_TOKEN).
 * - Only the endpoints the app uses are forwarded, GET only (no open proxy).
 * - Successful responses are cached in memory per instance; identical in-flight requests share
 *   one upstream call.
 * - Errors use the same JSON codes the app understands: { error: { code, message } }.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

const ALLOWED_PATHS = [
  /^\/discover\/movie$/,
  /^\/movie\/\d{1,10}$/,
  /^\/movie\/\d{1,10}\/recommendations$/,
  /^\/trending\/movie\/(day|week)$/,
  /^\/search\/movie$/,
];

const MAX_QUERY_LENGTH = 2048;
const MAX_PARAMS = 30;
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 500;
const TIMEOUT_MS = 8_000;
const CLIENT_MAX_AGE_SEC = 300;

const token = Deno.env.get("TMDB_TOKEN")?.trim();

interface Upstream {
  status: number;
  body: string;
  retryAfter: string | null;
}

const cache = new Map<string, { expires: number; body: string }>();
const inFlight = new Map<string, Promise<Upstream>>();

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key); // refresh recency (Map keeps insertion order → oldest first)
  cache.set(key, hit);
  return hit.body;
}

function cacheSet(key: string, body: string) {
  cache.set(key, { body, expires: Date.now() + TTL_MS });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function callUpstream(key: string): Promise<Upstream> {
  const res = await fetch(TMDB_BASE + key, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.text(), retryAfter: res.headers.get("retry-after") };
}

function fetchShared(key: string) {
  let pending = inFlight.get(key);
  if (!pending) {
    pending = callUpstream(key).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

const json = (body: string, cacheStatus: "HIT" | "MISS") =>
  new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CLIENT_MAX_AGE_SEC}`,
      "X-Cache": cacheStatus,
    },
  });

const error = (status: number, code: string, message: string, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return error(405, "METHOD_NOT_ALLOWED", "Only GET is supported.", { Allow: "GET, HEAD" });
  }

  const url = new URL(req.url);
  // The platform passes "/tmdb/<path>" (sometimes with the /functions/v1 prefix); keep only <path>.
  const path = url.pathname.replace(/^(\/functions\/v1)?\/tmdb/, "") || "/";
  if (!ALLOWED_PATHS.some((re) => re.test(path))) {
    return error(404, "NOT_ALLOWED", "Unknown API route.");
  }
  if (url.search.length > MAX_QUERY_LENGTH || [...url.searchParams.keys()].length > MAX_PARAMS) {
    return error(414, "QUERY_TOO_LONG", "Query string is too long.");
  }
  if (!token) {
    return error(503, "MISSING_TMDB_TOKEN", "TMDB_TOKEN is not configured on the server.");
  }

  url.searchParams.sort(); // same params in any order → same cache key
  const query = url.searchParams.toString();
  const key = path + (query ? `?${query}` : "");

  const cached = cacheGet(key);
  if (cached !== undefined) return json(cached, "HIT");

  let upstream: Upstream;
  try {
    upstream = await fetchShared(key);
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    console.warn(`[tmdb] ${timedOut ? "timeout" : "network error"} on ${path}`);
    return timedOut
      ? error(504, "UPSTREAM_TIMEOUT", "TMDB took too long to respond.")
      : error(502, "UPSTREAM_UNREACHABLE", "Couldn't reach TMDB.");
  }

  if (upstream.status >= 200 && upstream.status < 300) {
    cacheSet(key, upstream.body);
    return json(upstream.body, "MISS");
  }
  if (upstream.status === 404) return error(404, "NOT_FOUND", "That title doesn't exist on TMDB.");
  if (upstream.status === 429) {
    return error(503, "UPSTREAM_RATE_LIMITED", "TMDB is busy. Try again shortly.", {
      "Retry-After": upstream.retryAfter ?? "10",
    });
  }
  if (upstream.status === 401 || upstream.status === 403) {
    console.error(`[tmdb] upstream rejected the token (${upstream.status}). Check TMDB_TOKEN.`);
    return error(502, "UPSTREAM_AUTH", "The server's TMDB credentials were rejected.");
  }
  console.warn(`[tmdb] upstream ${upstream.status} on ${path}`);
  return error(502, "UPSTREAM_ERROR", `TMDB returned ${upstream.status}.`);
});
