/**
 * `npm run db:migrate`: creates/updates every table.
 * Uses the DIRECT (unpooled) Neon URL, as Neon recommends for schema changes.
 */
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "./auth.js";
import { createPool } from "./db.js";
import { migrateApp } from "./migrations.js";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL). `neon env pull` writes both into .env.local.");
  process.exit(1);
}

const pool = createPool(url);
try {
  // 1. Better Auth's own tables, exactly as the installed version expects them.
  const auth = createAuth({ pool, secret: process.env.BETTER_AUTH_SECRET || "migration-only-secret" });
  const authMigrations = await getMigrations(auth.options);
  const pending = authMigrations.toBeCreated.length + authMigrations.toBeAdded.length + authMigrations.toBeAddedIndexes.length;
  if (authMigrations.unsafeChanges.length) {
    console.error("Better Auth reports unsafe schema changes; refusing to run:", authMigrations.unsafeChanges);
    process.exit(1);
  }
  await authMigrations.runMigrations();
  console.log(`auth: ${pending ? `applied ${pending} change(s)` : "up to date"}`);

  // 2. App tables, on one connection so each migration is a single transaction.
  const client = await pool.connect();
  try {
    const applied = await migrateApp(client, (m) => console.log(`app: ${m}`));
    if (!applied.length) console.log("app: up to date");
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
