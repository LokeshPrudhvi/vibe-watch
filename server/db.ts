import pg from "pg";

/** The slice of a Postgres client our code needs. `pg.Pool`, a pool client and PGlite (tests) all fit. */
export interface Db {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

/**
 * Long-running Express server → node-postgres with a reused pool, on Neon's *pooled*
 * DATABASE_URL (see the neon-postgres skill). Migrations use the direct URL instead.
 */
export function createPool(connectionString: string) {
  const pool = new pg.Pool({
    connectionString: explicitSsl(connectionString),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000, // Neon may be waking from scale-to-zero
  });
  // An idle client erroring (e.g. Neon suspending the compute) must not crash the process.
  pool.on("error", (err) => console.warn("[db] idle client error:", err.message));
  return pool;
}

/**
 * Neon URLs say sslmode=require, which pg 8 already treats as verify-full (certificate +
 * hostname checked) but warns will weaken in pg 9. Spell out verify-full to keep it strict.
 */
export function explicitSsl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  } catch {
    return connectionString;
  }
}
