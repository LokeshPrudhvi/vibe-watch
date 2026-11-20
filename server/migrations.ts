import type { Db } from "./db.js";

/**
 * App schema, as code. Each migration is a list of single statements (works with pg and
 * PGlite alike) and runs once, tracked in app_migrations. Never edit a shipped migration;
 * add a new one.
 *
 * Better Auth owns its own tables ("user", "session", "account", "verification") and
 * migrates them itself (see migrate.ts). Ours reference "user"(id) and cascade on delete,
 * so deleting an account deletes everything we stored about it.
 */
export const APP_MIGRATIONS: { id: string; statements: string[] }[] = [
  {
    id: "001_taste_sync",
    statements: [
      `create table if not exists user_consent (
        user_id text primary key references "user"(id) on delete cascade,
        share_activity boolean not null,
        policy_version text not null,
        decided_at timestamptz not null default now()
      )`,
      // Explicit choices, latest state per user × movie × type (mirrors the device's Library).
      `create table if not exists user_mark (
        user_id text not null references "user"(id) on delete cascade,
        movie_id integer not null check (movie_id > 0),
        type text not null check (type in ('like', 'save', 'seen', 'dislike')),
        marked_at timestamptz not null,
        movie jsonb not null,
        primary key (user_id, movie_id, type)
      )`,
      `create index if not exists user_mark_movie_type_idx on user_mark (movie_id, type)`,
      // Implicit behaviour (trailer plays, opens, skips, mood picks). client_id makes uploads idempotent.
      `create table if not exists user_signal (
        id bigserial primary key,
        user_id text not null references "user"(id) on delete cascade,
        client_id text not null,
        type text not null check (type in ('trailer', 'open', 'skip', 'mood')),
        movie_id integer,
        genres integer[] not null default '{}',
        lang text,
        at timestamptz not null,
        unique (user_id, client_id)
      )`,
      `create index if not exists user_signal_user_at_idx on user_signal (user_id, at desc)`,
      // Shared cache of TMDB credits (top cast + directors): one fetch per movie for everyone.
      `create table if not exists movie_people (
        movie_id integer primary key,
        directors jsonb not null,
        cast_members jsonb not null,
        fetched_at timestamptz not null default now()
      )`,
    ],
  },
];

/** Runs pending app migrations. `db` must be a single connection (transactions span statements). */
export async function migrateApp(db: Db, log: (msg: string) => void = () => {}) {
  await db.query(
    `create table if not exists app_migrations (id text primary key, applied_at timestamptz not null default now())`,
  );
  const done = new Set((await db.query<{ id: string }>("select id from app_migrations")).rows.map((r) => r.id));
  const applied: string[] = [];
  for (const m of APP_MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.query("begin");
    try {
      for (const sql of m.statements) await db.query(sql);
      await db.query("insert into app_migrations (id) values ($1)", [m.id]);
      await db.query("commit");
      applied.push(m.id);
      log(`applied ${m.id}`);
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  }
  return applied;
}
