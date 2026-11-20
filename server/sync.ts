import type { Db } from "./db.js";

/**
 * Wire format the web and mobile apps upload. The device stays the source of truth for the
 * user's own Library; the server keeps a copy so taste follows the account and so crowd
 * patterns can be found across users.
 */
export const MARK_TYPES = ["like", "save", "seen", "dislike"] as const;
export const SIGNAL_TYPES = ["trailer", "open", "skip", "mood"] as const;
export type MarkType = (typeof MARK_TYPES)[number];
export type SignalType = (typeof SIGNAL_TYPES)[number];

export interface MovieSnapshot {
  id: number;
  title: string;
  poster: string | null;
  genres: number[];
  lang?: string;
  year?: number;
  date?: string;
  status?: string;
}

export type SyncOp =
  | { op: "mark"; type: MarkType; at: number; movie: MovieSnapshot }
  | { op: "unmark"; type: MarkType; at: number; movieId: number }
  | { op: "signal"; type: SignalType; at: number; clientId: string; movieId?: number; genres: number[]; lang?: string };

export const MAX_OPS_PER_REQUEST = 200;
export const POLICY_VERSION = "2026-11-20";

const isInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isStr = (v: unknown, max = 300): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const isTime = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > Date.UTC(2020, 0, 1) && v < Date.now() + 86_400_000;
const isGenres = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 20 && v.every((g) => isInt(g));

function cleanMovie(m: unknown): MovieSnapshot | undefined {
  if (!m || typeof m !== "object") return undefined;
  const x = m as Record<string, unknown>;
  if (!isInt(x.id) || !isStr(x.title) || !isGenres(x.genres)) return undefined;
  if (!(x.poster === null || x.poster === undefined || isStr(x.poster, 200))) return undefined;
  return {
    id: x.id,
    title: x.title,
    poster: (x.poster as string | null | undefined) ?? null,
    genres: x.genres,
    ...(isStr(x.lang, 8) ? { lang: x.lang } : {}),
    ...(isInt(x.year) && x.year < 3000 ? { year: x.year } : {}),
    ...(isStr(x.date, 10) ? { date: x.date } : {}),
    ...(isStr(x.status, 40) ? { status: x.status } : {}),
  };
}

/** Strict parse of an upload. Returns the valid ops and a count of rejected ones. */
export function parseOps(body: unknown): { ops: SyncOp[]; rejected: number } | { error: string } {
  const list = (body as { ops?: unknown })?.ops;
  if (!Array.isArray(list)) return { error: "Expected { ops: [...] }." };
  if (list.length > MAX_OPS_PER_REQUEST) return { error: `At most ${MAX_OPS_PER_REQUEST} ops per request.` };
  const ops: SyncOp[] = [];
  let rejected = 0;
  for (const raw of list) {
    const o = raw as Record<string, unknown>;
    if (o?.op === "mark" && MARK_TYPES.includes(o.type as MarkType) && isTime(o.at)) {
      const movie = cleanMovie(o.movie);
      if (movie) {
        ops.push({ op: "mark", type: o.type as MarkType, at: o.at, movie });
        continue;
      }
    } else if (o?.op === "unmark" && MARK_TYPES.includes(o.type as MarkType) && isTime(o.at) && isInt(o.movieId)) {
      ops.push({ op: "unmark", type: o.type as MarkType, at: o.at, movieId: o.movieId });
      continue;
    } else if (
      o?.op === "signal" &&
      SIGNAL_TYPES.includes(o.type as SignalType) &&
      isTime(o.at) &&
      isStr(o.clientId, 100) &&
      isGenres(o.genres ?? []) &&
      (o.movieId === undefined || isInt(o.movieId))
    ) {
      ops.push({
        op: "signal",
        type: o.type as SignalType,
        at: o.at,
        clientId: o.clientId,
        movieId: o.movieId as number | undefined,
        genres: (o.genres as number[] | undefined) ?? [],
        ...(isStr(o.lang, 8) ? { lang: o.lang } : {}),
      });
      continue;
    }
    rejected++;
  }
  return { ops, rejected };
}

/**
 * Applies ops in order. Idempotent and safe out of order: a mark only overwrites an older
 * mark, an unmark only deletes a mark that is not newer than itself, signals dedupe on clientId.
 */
export async function applyOps(db: Db, userId: string, ops: SyncOp[]) {
  for (const op of ops) {
    if (op.op === "mark") {
      await db.query(
        `insert into user_mark (user_id, movie_id, type, marked_at, movie)
         values ($1, $2, $3, to_timestamp($4 / 1000.0), $5::jsonb)
         on conflict (user_id, movie_id, type) do update
           set marked_at = excluded.marked_at, movie = excluded.movie
           where user_mark.marked_at < excluded.marked_at`,
        [userId, op.movie.id, op.type, op.at, JSON.stringify(op.movie)],
      );
    } else if (op.op === "unmark") {
      await db.query(
        `delete from user_mark
         where user_id = $1 and movie_id = $2 and type = $3 and marked_at <= to_timestamp($4 / 1000.0)`,
        [userId, op.movieId, op.type, op.at],
      );
    } else {
      await db.query(
        `insert into user_signal (user_id, client_id, type, movie_id, genres, lang, at)
         values ($1, $2, $3, $4, $5::int[], $6, to_timestamp($7 / 1000.0))
         on conflict (user_id, client_id) do nothing`,
        [userId, op.clientId, op.type, op.movieId ?? null, op.genres, op.lang ?? null, op.at],
      );
    }
  }
}

export async function getConsent(db: Db, userId: string) {
  const { rows } = await db.query<{ share_activity: boolean; decided_at: Date; policy_version: string }>(
    `select share_activity, decided_at, policy_version from user_consent where user_id = $1`,
    [userId],
  );
  const r = rows[0];
  return r ? { share: r.share_activity, decidedAt: new Date(r.decided_at).toISOString(), policy: r.policy_version } : null;
}

/**
 * Records the user's choice. Turning sharing off also deletes their synced activity:
 * once consent is withdrawn we stop using it and don't keep it around.
 */
export async function setConsent(db: Db, userId: string, share: boolean) {
  await db.query(
    `insert into user_consent (user_id, share_activity, policy_version, decided_at)
     values ($1, $2, $3, now())
     on conflict (user_id) do update
       set share_activity = excluded.share_activity, policy_version = excluded.policy_version, decided_at = now()`,
    [userId, share, POLICY_VERSION],
  );
  if (!share) {
    await db.query(`delete from user_mark where user_id = $1`, [userId]);
    await db.query(`delete from user_signal where user_id = $1`, [userId]);
  }
}

export async function getMarks(db: Db, userId: string) {
  const { rows } = await db.query<{ type: MarkType; marked_at: Date; movie: MovieSnapshot }>(
    `select type, marked_at, movie from user_mark where user_id = $1 order by marked_at desc limit 2000`,
    [userId],
  );
  return rows.map((r) => ({ type: r.type, at: new Date(r.marked_at).getTime(), movie: r.movie }));
}
