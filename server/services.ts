import { createAuth } from "./auth.js";
import { createPool } from "./db.js";
import { createPeopleService } from "./people.js";
import type { ApiOptions } from "./api.js";

export interface ServiceEnv {
  TMDB_TOKEN?: string;
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  /** comma-separated extra origins for auth + cookie writes (e.g. a separate web host) */
  APP_ORIGINS?: string;
  CROWD_MIN_SUPPORT?: string;
}

/**
 * Builds the /api dependencies from env. Accounts need both DATABASE_URL and
 * BETTER_AUTH_SECRET; without them the app still runs (TMDB proxy + on-device recs only).
 */
export function createServices(env: ServiceEnv): ApiOptions & { describe: string } {
  const token = env.TMDB_TOKEN?.trim() || undefined;
  const origins = (env.APP_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const pool = env.DATABASE_URL ? createPool(env.DATABASE_URL) : undefined;
  const auth =
    pool && env.BETTER_AUTH_SECRET
      ? createAuth({ pool, secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL || undefined, trustedOrigins: origins })
      : undefined;

  return {
    tmdb: { token },
    pool,
    auth,
    people: createPeopleService({ token, db: pool }),
    crowdMinSupport: Number(env.CROWD_MIN_SUPPORT) || 3,
    allowedOrigins: origins,
    describe: `postgres=${pool ? "on" : "off"} accounts=${auth ? "on" : "off"}`,
  };
}
