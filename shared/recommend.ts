/**
 * On-device recommender. Nothing leaves the device except the TMDB lookups.
 *
 * 1. Profile — every interaction is an event. Events are folded into signed affinities for
 *    genres, original language and decade, with exponential time decay so taste can drift.
 * 2. Score — each candidate gets a blend of:
 *      quality (Bayesian-averaged rating), mood fit, personal affinity (genre, language, era,
 *      and the cast and directors you keep choosing, all scaled by how much we know about
 *      you), collaborative signal (TMDB "people who liked X also liked Y" for the movies you
 *      loved/saved), crowd signal (what *our* users with your taste loved, from the server),
 *      a little popularity, minus penalties for recent skips, plus a tiny day-seeded jitter
 *      so tonight's pick doesn't stay frozen for weeks.
 * 3. Diversify — Maximal Marginal Relevance re-ranking so the list isn't ten copies of one film.
 * 4. Explain — every pick carries the strongest reason it was chosen.
 */
import type { Mood } from "./moods";
import { GENRES } from "./moods";
import { languageLabel } from "./languages";
import type { MovieSummary } from "./tmdb";

/* ---------- Events ---------- */

export interface MovieLite {
  id: number;
  title: string;
  poster: string | null;
  genres: number[];
  lang?: string;
  year?: number;
  /** YYYY-MM-DD; lets the UI block "Seen it" on films that aren't out yet */
  date?: string;
  status?: string;
}

/** Explicit, user-visible choices (shown in Library). */
export type MarkType = "like" | "save" | "seen" | "dislike";
/** Implicit behaviour. */
export type SignalType = "trailer" | "open" | "skip" | "mood";

export interface Mark {
  type: MarkType;
  at: number;
  movie: MovieLite;
}

export interface Signal {
  type: SignalType;
  at: number;
  id?: number;
  genres: number[];
  lang?: string;
  year?: number;
}

export const EVENT_WEIGHT: Record<MarkType | SignalType, number> = {
  like: 3,
  save: 1.5,
  seen: 0.6,
  dislike: -2.5,
  trailer: 1,
  open: 0.5,
  skip: -0.25,
  mood: 0.2,
};

const DAY = 86_400_000;
const TASTE_HALF_LIFE = 60 * DAY;
const SKIP_HALF_LIFE = 3 * DAY;

const decay = (age: number, halfLife: number) => 0.5 ** (Math.max(0, age) / halfLife);

/* ---------- Cast & crew ---------- */

export interface Credit {
  id: number;
  name: string;
}

/** Directors + top-billed cast for one movie (the server's /api/movies/people shape). */
export interface MoviePeople {
  directors: Credit[];
  cast: Credit[];
}

/** movie id → its people. Missing ids simply contribute nothing. */
export type PeopleMap = Record<number, MoviePeople>;

/** Directors shape a film more than any one actor; leads more than the rest of the cast. */
const DIRECTOR_SHARE = 0.8;
const CAST_SHARE = [0.5, 0.5, 0.3, 0.3] as const;

/* ---------- Profile ---------- */

export interface TasteProfile {
  /** signed, normalised to [-1, 1] */
  genres: Record<number, number>;
  langs: Record<string, number>;
  decades: Record<number, number>;
  /** 0 → know nothing (cold start), → 1 as evidence accumulates */
  confidence: number;
  /** loved/saved titles, strongest first: seeds for collaborative filtering */
  seeds: { id: number; title: string; weight: number }[];
  /** seen or "not for me" → never recommended */
  hidden: Set<number>;
  /** decayed skip count per movie */
  skips: Record<number, number>;
  /** person id → signed affinity in [-1, 1] (directors and cast). Empty without a PeopleMap. */
  people?: Record<number, number>;
  /** person id → name, for explanations */
  peopleNames?: Record<number, string>;
}

function normalise<K extends string | number>(raw: Map<K, number>): Record<K, number> {
  let max = 0;
  for (const v of raw.values()) max = Math.max(max, Math.abs(v));
  const out = {} as Record<K, number>;
  for (const [k, v] of raw) out[k] = max ? v / max : 0;
  return out;
}

export const decadeOf = (year?: number) => (year ? Math.floor(year / 10) * 10 : undefined);

/**
 * @param people optional credits for the movies in `marks`/`signals`; with it the profile also
 *               learns which directors and actors you keep picking.
 */
export function buildProfile(marks: Mark[], signals: Signal[], now = Date.now(), people?: PeopleMap): TasteProfile {
  const genres = new Map<number, number>();
  const persons = new Map<number, number>();
  const personNames: Record<number, string> = {};
  const langs = new Map<string, number>();
  const decades = new Map<number, number>();
  const seeds = new Map<number, { id: number; title: string; weight: number }>();
  const hidden = new Set<number>();
  const skips: Record<number, number> = {};
  let evidence = 0;

  const learn = (w: number, g: number[], lang?: string, year?: number, movieId?: number) => {
    // split across genres so a 4-genre film doesn't count 4× as much as a 1-genre film
    const per = g.length ? w / Math.sqrt(g.length) : 0;
    for (const id of g) genres.set(id, (genres.get(id) ?? 0) + per);
    if (lang) langs.set(lang, (langs.get(lang) ?? 0) + w);
    const dec = decadeOf(year);
    if (dec) decades.set(dec, (decades.get(dec) ?? 0) + w * 0.5);
    const credits = movieId ? people?.[movieId] : undefined;
    if (credits) {
      const add = (p: Credit, share: number) => {
        persons.set(p.id, (persons.get(p.id) ?? 0) + w * share);
        personNames[p.id] = p.name;
      };
      credits.directors.slice(0, 2).forEach((d) => add(d, DIRECTOR_SHARE));
      credits.cast.slice(0, CAST_SHARE.length).forEach((a, i) => add(a, CAST_SHARE[i]));
    }
    evidence += Math.abs(w);
  };

  for (const m of marks) {
    const w = EVENT_WEIGHT[m.type] * decay(now - m.at, TASTE_HALF_LIFE);
    learn(w, m.movie.genres, m.movie.lang, m.movie.year, m.movie.id);
    if (m.type === "seen" || m.type === "dislike") hidden.add(m.movie.id);
    if (m.type === "like" || m.type === "save") {
      const prev = seeds.get(m.movie.id);
      seeds.set(m.movie.id, { id: m.movie.id, title: m.movie.title, weight: (prev?.weight ?? 0) + w });
    }
  }

  for (const s of signals) {
    if (s.type === "skip" && s.id) {
      skips[s.id] = (skips[s.id] ?? 0) + decay(now - s.at, SKIP_HALF_LIFE);
    }
    learn(EVENT_WEIGHT[s.type] * decay(now - s.at, TASTE_HALF_LIFE), s.genres, s.lang, s.year, s.id);
  }

  // a disliked title is not a seed even if it was saved earlier
  for (const id of hidden) {
    if (marks.some((m) => m.movie.id === id && m.type === "dislike")) seeds.delete(id);
  }

  return {
    genres: normalise(genres),
    langs: normalise(langs),
    decades: normalise(decades),
    confidence: 1 - Math.exp(-evidence / 6),
    seeds: [...seeds.values()].filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight),
    hidden,
    skips,
    people: normalise(persons),
    peopleNames: personNames,
  };
}

/* ---------- Collaborative signal ---------- */

export type CollabMap = Map<number, { score: number; seed: string }>;

/**
 * Turns TMDB's per-title recommendation lists for your seeds into a [0, 1] score per movie.
 * Higher-ranked appearances and stronger seeds count more; multiple seeds combine as noisy-OR.
 */
export function buildCollab(seeds: TasteProfile["seeds"], lists: MovieSummary[][]): CollabMap {
  const out: CollabMap = new Map();
  const top = seeds[0]?.weight || 1;
  seeds.forEach((seed, i) => {
    const list = lists[i] ?? [];
    const strength = Math.min(1, seed.weight / top);
    list.forEach((m, rank) => {
      const p = strength * (1 - rank / (list.length * 1.5)) * 0.85;
      const prev = out.get(m.id);
      const score = 1 - (1 - (prev?.score ?? 0)) * (1 - p);
      out.set(m.id, { score, seed: prev && prev.score >= p ? prev.seed : seed.title });
    });
  });
  return out;
}

/* ---------- Crowd signal (our own users) ---------- */

export type CrowdMap = Map<number, { score: number; seed: string; support: number }>;

/**
 * Turns the server's "users who loved what you loved also loved…" list into a [0, 1] score per
 * movie (top item = 1). `titles` names your own seed titles for the explanation.
 */
export function buildCrowd(
  items: { movieId: number; score: number; support: number; because: number }[],
  titles: Record<number, string>,
): CrowdMap {
  const out: CrowdMap = new Map();
  const top = Math.max(0, ...items.map((i) => i.score)) || 1;
  for (const i of items) {
    out.set(i.movieId, { score: Math.min(1, i.score / top), seed: titles[i.because] ?? "", support: i.support });
  }
  return out;
}

/* ---------- Scoring ---------- */

export interface Recommendation {
  movie: MovieSummary;
  score: number;
  /** 40–99, shown in the match ring */
  match: number;
  reason: string;
}

export interface RankContext {
  mood?: Mood;
  profile: TasteProfile;
  collab?: CollabMap;
  /** credits for the candidates; enables "More from <director>" / "More with <actor>" */
  people?: PeopleMap;
  /** what our users with your taste loved (server, needs sign-in + sharing) */
  crowd?: CrowdMap;
  now?: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** IMDb-style weighted rating: pulls low-vote titles toward the global mean. */
export function bayesianRating(avg: number, votes: number, prior = 6.6, priorVotes = 300) {
  return (votes * avg + priorVotes * prior) / (votes + priorVotes);
}

/** Deterministic 0..1 noise per (movie, day). */
function dayJitter(id: number, now: number) {
  let h = (id ^ Math.floor(now / DAY)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

const langName = languageLabel;

export function scoreMovie(m: MovieSummary, ctx: RankContext): Recommendation {
  const { profile, mood, collab, crowd } = ctx;
  const now = ctx.now ?? Date.now();
  const c = profile.confidence;
  const year = m.release_date ? Number(m.release_date.slice(0, 4)) : undefined;

  const quality = clamp01((bayesianRating(m.vote_average, m.vote_count) - 5.8) / 2.6);

  const overlap = mood ? m.genre_ids.filter((g) => mood.genres.includes(g)).length : 1;
  const clash = mood ? m.genre_ids.some((g) => mood.exclude.includes(g)) : false;
  const moodFit = clamp01(overlap / 2 - (clash ? 0.5 : 0));

  const genreAff = m.genre_ids.length
    ? m.genre_ids.reduce((s, g) => s + (profile.genres[g] ?? 0), 0) / m.genre_ids.length
    : 0;
  const langAff = m.original_language ? (profile.langs[m.original_language] ?? 0) : 0;
  const dec = decadeOf(year);
  const eraAff = dec ? (profile.decades[dec] ?? 0) : 0;
  const col = collab?.get(m.id);
  const collabScore = col?.score ?? 0;
  const popularity = clamp01(Math.log10(1 + (m.popularity ?? 0)) / 2.5);
  const skipPenalty = 0.3 * (profile.skips[m.id] ?? 0);
  const crowdHit = crowd?.get(m.id);
  const crowdScore = crowdHit?.score ?? 0;

  // strongest director / actor opinion you hold about this film (positive or negative)
  const credits = ctx.people?.[m.id];
  const personAff = profile.people ?? {};
  let dirAff = 0;
  let dirName = "";
  for (const d of credits?.directors ?? []) {
    const v = personAff[d.id] ?? 0;
    if (Math.abs(v) > Math.abs(dirAff)) [dirAff, dirName] = [v, d.name];
  }
  let castAff = 0;
  let castName = "";
  (credits?.cast ?? []).slice(0, 4).forEach((a, i) => {
    const v = (personAff[a.id] ?? 0) * (i < 2 ? 1 : 0.7);
    if (Math.abs(v) > Math.abs(castAff)) [castAff, castName] = [v, a.name];
  });
  const peopleAff = Math.max(-1, Math.min(1, 0.6 * dirAff + 0.45 * castAff));

  const personal = c * (0.3 * genreAff + 0.12 * langAff + 0.05 * eraAff + 0.2 * peopleAff);
  const score =
    0.3 * quality +
    0.16 * moodFit +
    0.08 * popularity +
    personal +
    0.28 * collabScore +
    0.22 * crowdScore +
    (dayJitter(m.id, now) - 0.5) * 0.06 -
    skipPenalty;

  // match % is about fit to *you*, so it leans on taste + collab + crowd, not on popularity
  const taste = c * ((genreAff + 1) / 2) + (1 - c) * 0.5;
  const langFit = c * ((langAff + 1) / 2) + (1 - c) * 0.5;
  const peopleFit = c * ((peopleAff + 1) / 2) + (1 - c) * 0.5;
  const m01 =
    0.3 * quality +
    0.26 * taste +
    0.05 * langFit +
    0.08 * moodFit +
    0.15 * collabScore +
    0.08 * peopleFit +
    0.08 * crowdScore;
  const match = Math.round(Math.min(99, Math.max(40, 40 + 62 * m01)));

  return { movie: m, score, match, reason: explain() };

  function explain() {
    // its own director/cast would otherwise "explain" a film you already loved or saved
    if (profile.seeds.some((s) => s.id === m.id)) return "On your list";
    if (crowdHit?.seed && crowdScore > 0.3) return `Loved by fans of ${crowdHit.seed}`;
    if (col && collabScore > 0.25) return `Because you liked ${col.seed}`;
    if (dirName && c * dirAff > 0.3) return `More from ${dirName}`;
    if (castName && c * castAff > 0.3) return `More with ${castName}`;
    if (c * genreAff > 0.25) {
      const best = [...m.genre_ids].sort((a, b) => (profile.genres[b] ?? 0) - (profile.genres[a] ?? 0))[0];
      if (best && GENRES[best]) return `Your kind of ${GENRES[best]}`;
    }
    if (c * langAff > 0.35 && m.original_language && m.original_language !== "en") {
      return `More ${langName(m.original_language)} for you`;
    }
    if (quality > 0.78) return "Critically loved";
    if (popularity > 0.85) return "Everyone's watching this";
    return mood ? `A solid ${mood.label.toLowerCase()} pick` : "Picked for you";
  }
}

/* ---------- Diversity ---------- */

function similarity(a: MovieSummary, b: MovieSummary) {
  const ga = new Set(a.genre_ids);
  const inter = b.genre_ids.filter((g) => ga.has(g)).length;
  const union = new Set([...a.genre_ids, ...b.genre_ids]).size || 1;
  const sameLang = a.original_language && a.original_language === b.original_language ? 1 : 0;
  const sameDecade = decadeOf(Number(a.release_date?.slice(0, 4))) === decadeOf(Number(b.release_date?.slice(0, 4))) ? 1 : 0;
  return 0.6 * (inter / union) + 0.25 * sameLang + 0.15 * sameDecade;
}

/** Maximal Marginal Relevance: trade a little relevance for a lot less repetition. */
export function diversify(recs: Recommendation[], lambda = 0.78): Recommendation[] {
  if (recs.length < 3) return [...recs].sort((a, b) => b.score - a.score);
  // Raw scores (already ~0–1), not min-max normalised: normalising would blow tiny,
  // meaningless score gaps up to the full range and let relevance drown out diversity.
  const rel = new Map(recs.map((r) => [r, r.score]));

  const remaining = [...recs].sort((a, b) => b.score - a.score);
  const picked: Recommendation[] = [remaining.shift()!];
  while (remaining.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    remaining.forEach((r, i) => {
      const maxSim = Math.max(...picked.map((p) => similarity(r.movie, p.movie)));
      const val = lambda * rel.get(r)! - (1 - lambda) * maxSim;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    });
    picked.push(remaining.splice(bestIdx, 1)[0]);
  }
  return picked;
}

/* ---------- Entry point ---------- */

export function recommend(pool: MovieSummary[], ctx: RankContext): Recommendation[] {
  const seen = new Set<number>();
  const unique = pool.filter((m) => {
    if (seen.has(m.id) || ctx.profile.hidden.has(m.id) || !m.poster_path) return false;
    seen.add(m.id);
    return true;
  });
  return diversify(unique.map((m) => scoreMovie(m, ctx)));
}

/** Top liked/disliked genres for the Settings "what we've learned" view. */
export function tasteSummary(profile: TasteProfile, n = 5) {
  const entries = Object.entries(profile.genres)
    .map(([id, w]) => ({ id: Number(id), name: GENRES[Number(id)] ?? "Other", w }))
    .filter((g) => Math.abs(g.w) > 0.15);
  return {
    likes: entries.filter((g) => g.w > 0).sort((a, b) => b.w - a.w).slice(0, n),
    dislikes: entries.filter((g) => g.w < 0).sort((a, b) => a.w - b.w).slice(0, 3),
    languages: Object.entries(profile.langs)
      .filter(([, w]) => w > 0.3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code]) => langName(code)),
  };
}
