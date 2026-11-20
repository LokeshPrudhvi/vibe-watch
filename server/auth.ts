import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { Pool } from "pg";

export const CLIENT_IP_HEADER = "x-vibe-client-ip";

export interface AuthConfig {
  pool: Pool;
  secret: string;
  /** Public origin of the API, e.g. https://vibe.example.com. Optional: inferred per request. */
  baseURL?: string;
  /** Extra origins allowed to call auth endpoints (the web app's own origin is always allowed). */
  trustedOrigins?: string[];
}

/**
 * Self-managed Better Auth on our Express host, data in Neon Postgres.
 * (Neon's Managed Auth wrapper is browser-only; the Expo app needs Better Auth's own client.)
 *
 * - Web: httpOnly session cookie (same origin).
 * - Mobile: `bearer()` → send `Authorization: Bearer <token>` (token from the sign-in response).
 */
export function createAuth({ pool, secret, baseURL, trustedOrigins = [] }: AuthConfig) {
  return betterAuth({
    appName: "vibe.",
    database: pool,
    secret,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh at most daily
    },
    plugins: [bearer()],
    advanced: {
      cookiePrefix: "vibe",
      // Per-client rate limits: server/api.ts overwrites this header with Express's req.ip
      // (which honours TRUST_PROXY), so clients can't spoof it.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    // Built-in limiter (stricter on sign-in/sign-up); our /api limiter sits in front as well.
    rateLimit: { enabled: true, window: 60, max: 100 },
  });
}

export type Auth = ReturnType<typeof createAuth>;
