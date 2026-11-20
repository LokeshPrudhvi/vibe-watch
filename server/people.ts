import type { Db } from "./db.js";

export interface Person {
  id: number;
  name: string;
}

export interface MoviePeople {
  directors: Person[];
  /** top-billed cast, in billing order */
  cast: Person[];
}

export interface PeopleServiceOptions {
  token: string | undefined;
  db?: Db;
  fetch?: typeof fetch;
  /** parallel TMDB credit fetches on a cache miss */
  concurrency?: number;
  /** re-fetch credits after this many days */
  ttlDays?: number;
  logger?: Pick<Console, "warn">;
}

export const MAX_IDS_PER_REQUEST = 120;
const TOP_CAST = 6;

interface TmdbCredits {
  cast?: { id: number; name: string; order?: number }[];
  crew?: { id: number; name: string; job?: string }[];
}

export function parseCredits(credits: TmdbCredits): MoviePeople {
  const directors = (credits.crew ?? [])
    .filter((c) => c.job === "Director")
    .slice(0, 3)
    .map(({ id, name }) => ({ id, name }));
  const cast = [...(credits.cast ?? [])]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, TOP_CAST)
    .map(({ id, name }) => ({ id, name }));
  return { directors, cast };
}

/**
 * Cast & directors for many movies at once. Postgres is a shared cache (one TMDB call per
 * movie for all users); without a database it falls back to an in-memory cache.
 */
export function createPeopleService({
  token,
  db,
  fetch: fetchImpl = globalThis.fetch,
  concurrency = 6,
  ttlDays = 30,
  logger = console,
}: PeopleServiceOptions) {
  const memory = new Map<number, MoviePeople>();

  async function fromCache(ids: number[]): Promise<Map<number, MoviePeople>> {
    const out = new Map<number, MoviePeople>();
    if (!db) {
      for (const id of ids) {
        const hit = memory.get(id);
        if (hit) out.set(id, hit);
      }
      return out;
    }
    const { rows } = await db.query<{ movie_id: number; directors: Person[]; cast_members: Person[] }>(
      `select movie_id, directors, cast_members from movie_people
       where movie_id = any($1::int[]) and fetched_at > now() - make_interval(days => $2)`,
      [ids, ttlDays],
    );
    for (const r of rows) out.set(r.movie_id, { directors: r.directors, cast: r.cast_members });
    return out;
  }

  async function store(id: number, people: MoviePeople) {
    if (!db) {
      memory.set(id, people);
      if (memory.size > 5000) memory.delete(memory.keys().next().value!);
      return;
    }
    await db.query(
      `insert into movie_people (movie_id, directors, cast_members, fetched_at)
       values ($1, $2::jsonb, $3::jsonb, now())
       on conflict (movie_id) do update
         set directors = excluded.directors, cast_members = excluded.cast_members, fetched_at = now()`,
      [id, JSON.stringify(people.directors), JSON.stringify(people.cast)],
    );
  }

  async function fetchCredits(id: number): Promise<MoviePeople | undefined> {
    const res = await fetchImpl(`https://api.themoviedb.org/3/movie/${id}/credits?language=en-US`, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      if (res.status !== 404) logger.warn(`[people] TMDB ${res.status} for movie ${id}`);
      return undefined;
    }
    return parseCredits((await res.json()) as TmdbCredits);
  }

  return {
    /** Unknown or failed ids are simply absent from the result. */
    async get(rawIds: number[]): Promise<Record<number, MoviePeople>> {
      const ids = [...new Set(rawIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_IDS_PER_REQUEST);
      const found = ids.length ? await fromCache(ids) : new Map<number, MoviePeople>();
      const misses = ids.filter((id) => !found.has(id));

      if (misses.length && token) {
        let next = 0;
        const worker = async () => {
          while (next < misses.length) {
            const id = misses[next++];
            try {
              const people = await fetchCredits(id);
              if (!people) continue;
              found.set(id, people);
              await store(id, people);
            } catch (err) {
              logger.warn(`[people] movie ${id}: ${(err as Error).message}`);
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, misses.length) }, worker));
      }
      return Object.fromEntries(found);
    },
  };
}

export type PeopleService = ReturnType<typeof createPeopleService>;
