import type { Db } from "./db.js";

export interface CrowdItem {
  movieId: number;
  /** sum of item-to-item cosine similarities to the user's loved/saved titles */
  score: number;
  /** how many *other* users loved both this and the strongest seed */
  support: number;
  /** the user's own title that this is most similar to (for "Loved by fans of …") */
  because: number;
}

/**
 * "People who loved what you loved also loved…": item-to-item collaborative filtering over
 * every consenting user's Love/Save marks.
 *
 *   sim(i, j) = users who loved both / sqrt(users who loved i × users who loved j)
 *   score(j)  = Σ over your loved titles i of sim(i, j)
 *
 * Privacy rules baked into the query:
 *   - only users with share_activity = true are counted, and never the requester themselves;
 *   - a pair needs at least `minSupport` distinct users, so nobody's individual list leaks;
 *   - anything the requester already marked (loved, saved, seen, hidden) is excluded.
 *
 * Fine for thousands of users as a live query; at larger scale, precompute sim(i, j) nightly.
 */
export async function crowdRecommendations(
  db: Db,
  userId: string,
  { minSupport = 3, limit = 100 }: { minSupport?: number; limit?: number } = {},
): Promise<CrowdItem[]> {
  const { rows } = await db.query<{ movie_id: number; score: number; support: number; because: number }>(
    `with mine as (
       select distinct movie_id from user_mark where user_id = $1 and type in ('like', 'save')
     ),
     excluded as (
       select movie_id from user_mark where user_id = $1
     ),
     pos as (
       select m.user_id, m.movie_id
       from user_mark m
       join user_consent c on c.user_id = m.user_id and c.share_activity
       where m.type in ('like', 'save') and m.user_id <> $1
       group by m.user_id, m.movie_id
     ),
     item_n as (
       select movie_id, count(*)::float8 as n from pos group by movie_id
     ),
     co as (
       select a.movie_id as seed, b.movie_id as item, count(*)::float8 as co
       from pos a
       join pos b on a.user_id = b.user_id and a.movie_id <> b.movie_id
       where a.movie_id in (select movie_id from mine)
         and b.movie_id not in (select movie_id from excluded)
       group by a.movie_id, b.movie_id
       having count(*) >= $2
     ),
     scored as (
       select co.item, co.seed, co.co, co.co / sqrt(ns.n * ni.n) as sim
       from co
       join item_n ns on ns.movie_id = co.seed
       join item_n ni on ni.movie_id = co.item
     )
     select item as movie_id,
            sum(sim)::float8 as score,
            max(co)::int as support,
            (array_agg(seed order by sim desc))[1] as because
     from scored
     group by item
     order by score desc, item
     limit $3`,
    [userId, minSupport, limit],
  );
  return rows.map((r) => ({
    movieId: Number(r.movie_id),
    score: Number(r.score),
    support: Number(r.support),
    because: Number(r.because),
  }));
}
