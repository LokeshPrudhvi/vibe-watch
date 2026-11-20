import express, { type NextFunction, type Request, type Response } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { Pool } from "pg";
import { CLIENT_IP_HEADER, type Auth } from "./auth.js";
import { crowdRecommendations } from "./crowd.js";
import type { PeopleService } from "./people.js";
import { applyOps, getConsent, getMarks, parseOps, setConsent } from "./sync.js";
import { createTmdbProxy, sendError, type TmdbProxyOptions } from "./tmdbProxy.js";

export interface ApiOptions {
  tmdb: TmdbProxyOptions;
  /** Neon Postgres pool. Without it (or without auth), account routes answer 503 ACCOUNTS_DISABLED. */
  pool?: Pool;
  auth?: Auth;
  people?: PeopleService;
  /** A crowd pattern needs this many distinct other users before it's used. Default 3. */
  crowdMinSupport?: number;
  /** Extra origins (besides the API's own host) allowed to make cookie-authenticated writes. */
  allowedOrigins?: string[];
}

type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
type AuthedRequest = Request & { session?: Session };

/**
 * Everything under /api, as one Express app. Mounted by the production server (server/app.ts)
 * and by the Vite dev server (vite.config.ts), so both behave the same.
 */
export function createApi(opts: ApiOptions) {
  const { pool, auth, people } = opts;
  const app = express();
  app.disable("x-powered-by");

  // Better Auth reads the raw body itself, so it is mounted before express.json().
  if (auth) {
    const handler = toNodeHandler(auth);
    app.all("/api/auth/*splat", (req, res) => {
      req.headers[CLIENT_IP_HEADER] = req.ip ?? req.socket.remoteAddress ?? "unknown"; // never trust a client-sent value
      return handler(req, res);
    });
  }
  else app.all("/api/auth/*splat", (_req, res) => sendError(res, 503, "ACCOUNTS_DISABLED", "Accounts are not configured."));

  // Unchanged for the web app and the phone app (absolute URLs, no cookies, no Origin header).
  app.use("/api/tmdb", createTmdbProxy(opts.tmdb));

  app.use("/api", express.json({ limit: "200kb" }));

  // CSRF: cookie-authenticated writes must come from our own origin. Bearer (mobile) skips this.
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    if (req.headers.authorization?.startsWith("Bearer ")) return next();
    const origin = req.headers.origin;
    if (!origin) return next(); // non-browser clients; still need a valid session cookie below
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return sendError(res, 403, "BAD_ORIGIN", "Invalid Origin header.");
    }
    if (host === req.headers.host || opts.allowedOrigins?.includes(origin)) return next();
    return sendError(res, 403, "BAD_ORIGIN", "Cross-site request blocked.");
  });

  /* ---------- public ---------- */

  app.post("/api/movies/people", async (req, res, next) => {
    if (!people) return sendError(res, 503, "PEOPLE_DISABLED", "Cast data is not configured.");
    const ids = (req.body as { ids?: unknown })?.ids;
    if (!Array.isArray(ids)) return sendError(res, 400, "BAD_REQUEST", "Expected { ids: number[] }.");
    try {
      res.set("Cache-Control", "no-store").json({ people: await people.get(ids as number[]) });
    } catch (err) {
      next(err);
    }
  });

  /* ---------- signed-in ---------- */

  const accounts = (_req: Request, res: Response, next: NextFunction) =>
    pool && auth ? next() : sendError(res, 503, "ACCOUNTS_DISABLED", "Accounts are not configured.");

  const requireSession = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const session = await auth!.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) return sendError(res, 401, "UNAUTHENTICATED", "Sign in first.");
      req.session = session;
      next();
    } catch (err) {
      next(err);
    }
  };

  const requireSharing = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const consent = await getConsent(pool!, req.session!.user.id);
      if (!consent?.share) return sendError(res, 403, "CONSENT_REQUIRED", "Activity sharing is off.");
      next();
    } catch (err) {
      next(err);
    }
  };

  const me = express.Router();
  me.use(accounts, requireSession);

  me.get("/", async (req: AuthedRequest, res, next) => {
    try {
      const { user } = req.session!;
      res.set("Cache-Control", "no-store").json({
        user: { id: user.id, email: user.email, name: user.name },
        consent: await getConsent(pool!, user.id),
      });
    } catch (err) {
      next(err);
    }
  });

  me.put("/consent", async (req: AuthedRequest, res, next) => {
    const share = (req.body as { share?: unknown })?.share;
    if (typeof share !== "boolean") return sendError(res, 400, "BAD_REQUEST", "Expected { share: boolean }.");
    try {
      await setConsent(pool!, req.session!.user.id, share);
      res.json({ consent: await getConsent(pool!, req.session!.user.id) });
    } catch (err) {
      next(err);
    }
  });

  me.post("/events", requireSharing, async (req: AuthedRequest, res, next) => {
    const parsed = parseOps(req.body);
    if ("error" in parsed) return sendError(res, 400, "BAD_REQUEST", parsed.error);
    const client = await pool!.connect();
    try {
      await client.query("begin");
      await applyOps(client, req.session!.user.id, parsed.ops);
      await client.query("commit");
      res.json({ applied: parsed.ops.length, rejected: parsed.rejected });
    } catch (err) {
      await client.query("rollback").catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  });

  me.get("/marks", async (req: AuthedRequest, res, next) => {
    try {
      res.set("Cache-Control", "no-store").json({ marks: await getMarks(pool!, req.session!.user.id) });
    } catch (err) {
      next(err);
    }
  });

  me.get("/crowd", requireSharing, async (req: AuthedRequest, res, next) => {
    try {
      const items = await crowdRecommendations(pool!, req.session!.user.id, { minSupport: opts.crowdMinSupport });
      res.set("Cache-Control", "private, max-age=300").json({ items });
    } catch (err) {
      next(err);
    }
  });

  /** Deletes the account and, by cascade, every row we hold about it. */
  me.delete("/", async (req: AuthedRequest, res, next) => {
    try {
      await pool!.query(`delete from "user" where id = $1`, [req.session!.user.id]);
      for (const name of ["vibe.session_token", "__Secure-vibe.session_token", "vibe.session_data", "__Secure-vibe.session_data"]) {
        res.clearCookie(name, { path: "/" });
      }
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  app.use("/api/me", me);

  app.use("/api", (_req: Request, res: Response) => sendError(res, 404, "NOT_FOUND", "Unknown API route."));

  app.use("/api", (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const status = (err as { status?: number })?.status;
    if (status === 400 || status === 413) {
      return sendError(res, status, "BAD_REQUEST", status === 413 ? "Request too large." : "Malformed JSON.");
    }
    console.error("[api]", err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  });

  return app;
}
