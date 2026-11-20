import type { Mood } from "./moods";

/**
 * The proxy (server/tmdbProxy.ts) holds the TMDB token; clients never do.
 * Web: same origin, so the default relative path. Mobile: an absolute URL set at startup.
 */
let BASE = "/api/tmdb";

/** Points the client at a proxy on another host, e.g. "https://vibe.example.com/api/tmdb". */
export function setApiBase(url: string) {
  BASE = url.replace(/\/+$/, "");
}

export const getApiBase = () => BASE;

export const REGION = "IN";

/** Error codes the proxy can return, plus NETWORK for "the request never got an answer". */
export type ApiErrorCode =
  | "MISSING_TMDB_TOKEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNREACHABLE"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_ERROR"
  | "NETWORK"
  | (string & {});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Retry server hiccups and network blips; never retry bad requests or config problems. */
export function isRetryable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.code === "MISSING_TMDB_TOKEN" || error.code === "UPSTREAM_AUTH") return false;
  return error.status === 0 || error.status >= 500;
}

/* ---------- Types (only the fields we use) ---------- */
export interface Paged<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface MovieSummary {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  release_date: string;
  original_language?: string;
  popularity?: number;
}

export interface Video {
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}

export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface RegionProviders {
  link?: string;
  flatrate?: Provider[];
  free?: Provider[];
  ads?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
}

export interface MovieDetails extends Omit<MovieSummary, "genre_ids"> {
  runtime: number | null;
  tagline: string;
  /** "Released", "Post Production", "In Production", "Planned", "Rumored", "Canceled" */
  status?: string;
  genres: { id: number; name: string }[];
  videos?: { results: Video[] };
  "watch/providers"?: { results: Record<string, RegionProviders> };
  credits?: { cast: CastMember[]; crew: CrewMember[] };
  keywords?: { keywords: { id: number; name: string }[] };
  release_dates?: {
    results: { iso_3166_1: string; release_dates: { certification: string; release_date: string; type: number }[] }[];
  };
}

/* ---------- Core fetcher ---------- */
type Params = Record<string, string | number | boolean | undefined>;

async function tmdb<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") query.set(k, String(v));
  }
  const qs = query.toString(); // not query.size: Safari < 17 lacks it
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, signal });
  } catch (err) {
    if (signal?.aborted) throw err; // let TanStack Query see the cancellation
    throw new ApiError(0, "NETWORK", "Network request failed");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UPSTREAM_ERROR",
      body?.error?.message ?? `Request failed (${res.status})`,
    );
  }
  return (await res.json()) as T;
}

/* ---------- Images ---------- */
/** Posters: w92 w154 w185 w342 w500 w780. Backdrops: w300 w780 w1280. Logos: w45 w92 w154. */
export type ImgSize = "w45" | "w92" | "w154" | "w185" | "w300" | "w342" | "w500" | "w780" | "w1280" | "original";

export function tmdbImage(path: string | null | undefined, size: ImgSize = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}

/* ---------- Endpoints ---------- */

export interface DiscoverOptions {
  page?: number;
  sort?: string;
  minVotes?: number;
  /** ISO 639-1 original language, e.g. "hi" */
  language?: string;
}

/** Mood + time-fit search: only movies that fit the time you have and are watchable in India. */
export function discoverByVibe(mood: Mood, maxRuntime: number, opts: DiscoverOptions = {}, signal?: AbortSignal) {
  return tmdb<Paged<MovieSummary>>(
    "/discover/movie",
    {
      include_adult: false,
      language: "en-US",
      page: opts.page ?? 1,
      sort_by: opts.sort ?? mood.sort,
      "vote_count.gte": opts.minVotes ?? mood.minVotes,
      "vote_average.gte": mood.minRating,
      with_original_language: opts.language,
      with_genres: mood.genres.join("|"), // OR
      without_genres: mood.exclude.join(","),
      "with_runtime.gte": 60,
      "with_runtime.lte": maxRuntime,
      watch_region: REGION,
      with_watch_monetization_types: "flatrate|free|ads|rent",
    },
    signal,
  );
}

export function getMovie(id: number, signal?: AbortSignal) {
  return tmdb<MovieDetails>(
    `/movie/${id}`,
    { language: "en-US", append_to_response: "videos,watch/providers" },
    signal,
  );
}

/** Everything the detail screen needs in one request. */
export function getMovieFull(id: number, signal?: AbortSignal) {
  return tmdb<MovieDetails>(
    `/movie/${id}`,
    { language: "en-US", append_to_response: "videos,watch/providers,credits,keywords,release_dates" },
    signal,
  );
}

export function getTrending(signal?: AbortSignal) {
  return tmdb<Paged<MovieSummary>>("/trending/movie/week", { language: "en-US" }, signal);
}

/** TMDB's item-to-item recommendations ("people who liked this also liked…"). */
export function getRecommendations(id: number, signal?: AbortSignal) {
  return tmdb<Paged<MovieSummary>>(`/movie/${id}/recommendations`, { language: "en-US", page: 1 }, signal);
}

export function searchMovies(query: string, page = 1, signal?: AbortSignal) {
  return tmdb<Paged<MovieSummary>>(
    "/search/movie",
    { query, include_adult: false, language: "en-US", region: REGION, page },
    signal,
  );
}

/** Popular films originally in `lang` that you can stream or rent in India. */
export function discoverByLanguage(lang: string, page = 1, signal?: AbortSignal) {
  return tmdb<Paged<MovieSummary>>(
    "/discover/movie",
    {
      include_adult: false,
      language: "en-US",
      page,
      sort_by: "popularity.desc",
      with_original_language: lang,
      "vote_count.gte": 10,
      watch_region: REGION,
      with_watch_monetization_types: "flatrate|free|ads|rent",
    },
    signal,
  );
}

/* ---------- Helpers ---------- */
/**
 * Famous, already-released films (most votes first), optionally in one original language.
 * Used to build the onboarding swipe deck: people can only judge films they recognise.
 */
export function discoverClassics(opts: { language?: string; page?: number } = {}, signal?: AbortSignal) {
  return tmdb<Paged<MovieSummary>>(
    "/discover/movie",
    {
      include_adult: false,
      language: "en-US",
      page: opts.page ?? 1,
      sort_by: "vote_count.desc",
      with_original_language: opts.language,
      "vote_count.gte": 200,
      "primary_release_date.lte": todayISO(),
    },
    signal,
  );
}

export function pickTrailer(videos?: { results: Video[] }) {
  const yt = videos?.results.filter((v) => v.site === "YouTube") ?? [];
  return (
    yt.find((v) => v.type === "Trailer" && v.official) ??
    yt.find((v) => v.type === "Trailer") ??
    yt.find((v) => v.type === "Teaser")
  );
}

function dedupe(list: Provider[]) {
  const seen = new Set<number>();
  return list
    .filter((p) => (seen.has(p.provider_id) ? false : (seen.add(p.provider_id), true)))
    .sort((a, b) => a.display_priority - b.display_priority);
}

/** Splits India availability into "watch with a subscription/free" vs "rent or buy". */
export function availability(details?: MovieDetails, region = REGION) {
  const r = details?.["watch/providers"]?.results?.[region];
  return {
    watch: dedupe([...(r?.flatrate ?? []), ...(r?.free ?? []), ...(r?.ads ?? [])]),
    rent: dedupe([...(r?.rent ?? []), ...(r?.buy ?? [])]),
    link: r?.link,
  };
}

/** India availability split three ways for the detail screen. */
export function providerGroups(details?: MovieDetails, region = REGION) {
  const r = details?.["watch/providers"]?.results?.[region];
  return {
    stream: dedupe([...(r?.flatrate ?? []), ...(r?.free ?? []), ...(r?.ads ?? [])]),
    rent: dedupe(r?.rent ?? []),
    buy: dedupe(r?.buy ?? []),
    link: r?.link,
  };
}

export const yearOf = (date?: string) => (date ? date.slice(0, 4) : "");

/** Local calendar date as YYYY-MM-DD (TMDB's release_date format). */
export function todayISO(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Out yet? No date counts as not released (TMDB leaves it blank for announced/rumoured films).
 * `status` from the details endpoint wins when present.
 */
export function isReleased(date?: string | null, status?: string, now = new Date()) {
  if (status && status !== "Released") return false;
  return !!date && date <= todayISO(now);
}

/** "18 Dec" this year, "18 Dec 2027" otherwise, "TBA" with no date. */
export function releaseLabel(date?: string | null, now = new Date()) {
  if (!date) return "TBA";
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** India age rating (e.g. "UA 13+"), falling back to the US one. */
export function certification(details?: MovieDetails) {
  const results = details?.release_dates?.results ?? [];
  for (const region of [REGION, "US"]) {
    const cert = results
      .find((r) => r.iso_3166_1 === region)
      ?.release_dates.map((d) => d.certification.trim())
      .find(Boolean);
    if (cert) return { cert, region };
  }
  return undefined;
}
