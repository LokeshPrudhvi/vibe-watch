import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createServices } from "./services.js";

const env = process.env;
if (!env.TMDB_TOKEN?.trim()) {
  console.error("TMDB_TOKEN is not set. Add your TMDB API Read Access Token to the environment.");
  process.exit(1);
}
if (env.DATABASE_URL && !env.BETTER_AUTH_SECRET) {
  console.error("DATABASE_URL is set but BETTER_AUTH_SECRET is not. Generate one: openssl rand -base64 32");
  process.exit(1);
}

const port = Number(env.PORT) || 3000;
const host = env.HOST || "0.0.0.0";
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const services = createServices(env);

const app = createApp({
  ...services,
  distDir,
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  apiRateLimitPerMinute: Number(env.API_RATE_LIMIT_PER_MINUTE) || undefined,
});

const server = app.listen(port, host, () => {
  console.log(`vibe. listening on http://localhost:${port} (${services.describe})`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await services.pool?.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // don't hang on keep-alive sockets
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/** "1" → 1 hop, "true"/"false" → boolean, anything else (e.g. "loopback") passed through. */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (!value) return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}
