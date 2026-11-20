import path from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { createApi, type ApiOptions } from "./api.js";
import { sendError } from "./tmdbProxy.js";

export interface AppOptions extends ApiOptions {
  /** Folder with the Vite build (index.html + assets/). */
  distDir: string;
  /**
   * Express "trust proxy" setting. Set it when running behind a load balancer
   * (Render, Railway, Fly, Nginx…) so rate limiting sees the real client IP.
   */
  trustProxy?: boolean | number | string;
  /** API requests per IP per minute. Default 300. */
  apiRateLimitPerMinute?: number;
}

export function createApp({ distDir, trustProxy = false, apiRateLimitPerMinute = 300, ...api }: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "https://fonts.googleapis.com"],
          fontSrc: ["https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://image.tmdb.org"],
          connectSrc: ["'self'"],
          frameSrc: ["https://www.youtube-nocookie.com"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      // YouTube embeds refuse to play without a referrer
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.use(compression());

  // Doesn't touch the database on purpose: frequent health checks would keep Neon's
  // compute from scaling to zero.
  app.get("/healthz", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ ok: true });
  });

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: apiRateLimitPerMinute,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED", "Too many requests. Slow down a little."),
  });
  app.use("/api", apiLimiter);
  app.use(createApi(api));

  // Hashed build assets never change → cache for a year. Everything else revalidates.
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        const rel = path.relative(distDir, filePath);
        res.setHeader(
          "Cache-Control",
          rel.startsWith(`assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    }),
  );

  // SPA fallback: client-side routes (/stats, /title/movie/123…) get index.html.
  // Requests for files that don't exist (/assets/old.js) get a real 404.
  const indexHtml = path.join(distDir, "index.html");
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || path.extname(req.path)) return next();
    res.set("Cache-Control", "no-cache");
    res.sendFile(indexHtml, (err) => err && next(err));
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).type("text/plain").send("Not found");
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[server] unhandled error", err);
    if (res.headersSent) return;
    res.status(500).type("text/plain").send("Something went wrong");
  });

  return app;
}
