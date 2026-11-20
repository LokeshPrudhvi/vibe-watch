/**
 * TanStack Query hooks around the shared TMDB client and recommender (same behaviour as the
 * web's src/hooks/useTmdb.ts). Multi-page queries use `combine`, whose result TanStack shares
 * structurally, so the on-device ranking only re-runs when the data really changed.
 */
import { useMemo, useState } from "react";
import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  discoverByLanguage,
  discoverByVibe,
  getMovie,
  getMovieFull,
  getRecommendations,
  getTrending,
  searchMovies,
  tmdbImage,
  type DiscoverOptions,
  type MovieDetails,
  type MovieSummary,
  type Paged,
} from "@shared/tmdb";
import { MOODS, type MoodId } from "@shared/moods";
import { splitByLanguage } from "@shared/languages";
import { buildCollab, buildProfile, recommend, scoreMovie, type Recommendation, type TasteProfile } from "@shared/recommend";
import { useVibeStore } from "@/store/vibe";
import { extractAccent, FALLBACK_ACCENT } from "@/lib/accent";

export const isValidId = (id: unknown): id is number => Number.isInteger(id) && (id as number) > 0;

const NONE: MovieSummary[] = [];

/** Pages of movie lists → one stable object (see the note at the top). */
function combinePages(rs: UseQueryResult<Paged<MovieSummary>>[]) {
  return {
    lists: rs.map((r) => r.data?.results ?? NONE),
    isLoading: rs.some((r) => r.isLoading),
    isPlaceholderData: rs.some((r) => r.isPlaceholderData),
    settled: rs.every((r) => !r.isLoading && !r.isPlaceholderData),
    isError: rs[0]?.isError ?? false,
    error: rs[0]?.error ?? null,
    refetch: () => rs.forEach((r) => r.refetch()),
  };
}

export function useMovie(id?: number) {
  return useQuery({
    queryKey: ["movie", id],
    queryFn: ({ signal }) => getMovie(id!, signal),
    enabled: isValidId(id),
  });
}

/** Detail screen data: credits, keywords, age ratings, providers and videos in one request. */
export function useMovieFull(id?: number) {
  return useQuery({
    queryKey: ["movie-full", id],
    queryFn: ({ signal }) => getMovieFull(id!, signal),
    enabled: isValidId(id),
  });
}

export function useTrending() {
  return useQuery({
    queryKey: ["trending", "movie", "week"],
    queryFn: ({ signal }) => getTrending(signal),
    select: (d) => d.results.filter((m) => m.poster_path),
  });
}

/**
 * Title search. TMDB's search has no language parameter, so with a language picked we pull
 * three pages and split them: originals in that language first, other languages after.
 */
export function useSearch(query: string, lang?: string) {
  const q = query.trim();
  const pages = useQueries({
    queries: (lang ? [1, 2, 3] : [1]).map((page) => ({
      queryKey: ["search", q.toLowerCase(), page],
      queryFn: ({ signal }: { signal: AbortSignal }) => searchMovies(q, page, signal),
      enabled: q.length >= 2,
      placeholderData: keepPreviousData,
      staleTime: 60 * 60_000,
    })),
    combine: combinePages,
  });
  const { primary, others } = useMemo(() => {
    const seen = new Set<number>();
    const all = pages.lists.flat().filter((m) => {
      if (!m.poster_path || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    return splitByLanguage(all, lang);
  }, [pages.lists, lang]);
  return { ...pages, primary, others };
}

/** Browse a language: popular films in it (available in India), ranked for your taste. */
export function useLanguageBrowse(lang?: string) {
  const profile = useTasteProfile();
  const pages = useQueries({
    queries: (lang ? [1, 2] : []).map((page) => ({
      queryKey: ["discover-language", lang, page],
      queryFn: ({ signal }: { signal: AbortSignal }) => discoverByLanguage(lang!, page, signal),
      staleTime: 30 * 60_000,
    })),
    combine: combinePages,
  });
  const recs = useMemo(() => recommend(pages.lists.flat(), { profile }), [pages.lists, profile]);
  return { ...pages, recs };
}

/** The user's taste profile, rebuilt whenever they interact. */
export function useTasteProfile(): TasteProfile {
  const marks = useVibeStore((s) => s.marks);
  const signals = useVibeStore((s) => s.signals);
  return useMemo(() => buildProfile(marks, signals), [marks, signals]);
}

/** TMDB "also liked" lists for your top seeds → collaborative signal. */
export function useCollab(profile: TasteProfile, max = 3) {
  const seeds = useMemo(() => profile.seeds.slice(0, max), [profile.seeds, max]);
  const lists = useQueries({
    queries: seeds.map((s) => ({
      queryKey: ["recommendations", s.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => getRecommendations(s.id, signal),
      staleTime: 6 * 60 * 60_000,
    })),
    combine: combinePages,
  }).lists;
  return useMemo(() => buildCollab(seeds, lists), [seeds, lists]);
}

/**
 * Personalised, time-fitting, India-available picks for a mood.
 * Candidates come from several discover queries (mood × popular/acclaimed × your language),
 * then get ranked on-device by shared/recommend.
 */
export function useRecommendations(moodId: MoodId, maxRuntime: number) {
  const mood = MOODS[moodId];
  const profile = useTasteProfile();
  const collab = useCollab(profile);

  const topLang = Object.entries(profile.langs)
    .filter(([code, w]) => code !== "en" && w > 0.5)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const personalLang = profile.confidence > 0.3 ? topLang : undefined;

  const sources: { key: unknown[]; opts: DiscoverOptions }[] = [
    { key: ["p1"], opts: { page: 1 } },
    { key: ["p2"], opts: { page: 2 } },
    {
      key: ["alt"],
      opts:
        mood.sort === "vote_average.desc"
          ? { sort: "popularity.desc" }
          : { sort: "vote_average.desc", minVotes: mood.minVotes * 2 },
    },
    ...(personalLang ? [{ key: ["lang", personalLang], opts: { language: personalLang, minVotes: 40 } }] : []),
  ];

  const pages = useQueries({
    queries: sources.map((s) => ({
      queryKey: ["discover", moodId, maxRuntime, ...s.key],
      queryFn: ({ signal }: { signal: AbortSignal }) => discoverByVibe(mood, maxRuntime, s.opts, signal),
      placeholderData: keepPreviousData,
    })),
    combine: combinePages,
  });

  const ranked = useMemo(
    () => recommend(pages.lists.flat().filter((m) => m.backdrop_path), { mood, profile, collab }),
    [pages.lists, mood, profile, collab],
  );

  // Rank only once every source has answered, otherwise the pick flips as each page lands.
  // Until then keep showing the last settled ranking (state from the previous render, the
  // React-documented pattern, rather than a ref read during render).
  const [lastSettled, setLastSettled] = useState<Recommendation[]>([]);
  if (pages.settled && ranked !== lastSettled) setLastSettled(ranked);
  const recs = pages.settled || !lastSettled.length ? ranked : lastSettled;

  return {
    recs,
    isLoading: pages.isLoading && !lastSettled.length,
    isError: pages.isError,
    error: pages.error,
    isPlaceholderData: pages.lists.length > 0 && pages.isPlaceholderData,
    refetch: pages.refetch,
  };
}

/** One personalised row for Explore: a mood without the time limit. */
export function useMoodRow(moodId: MoodId) {
  const mood = MOODS[moodId];
  const profile = useTasteProfile();
  const query = useQuery({
    queryKey: ["discover", moodId, 240, "p1"],
    queryFn: ({ signal }) => discoverByVibe(mood, 240, {}, signal),
  });
  const recs = useMemo(
    () => (query.data ? recommend(query.data.results, { mood, profile }) : []),
    [query.data, mood, profile],
  );
  return { ...query, recs };
}

/** "Because you liked X" for the strongest seed. */
export function useBecauseYouLiked() {
  const profile = useTasteProfile();
  const seed = profile.seeds[0];
  const query = useQuery({
    queryKey: ["recommendations", seed?.id],
    queryFn: ({ signal }) => getRecommendations(seed!.id, signal),
    enabled: !!seed,
    staleTime: 6 * 60 * 60_000,
  });
  const movies = useMemo(
    () => (query.data?.results ?? []).filter((m) => m.poster_path && !profile.hidden.has(m.id)),
    [query.data, profile.hidden],
  );
  return { seed, movies, isLoading: query.isLoading };
}

const asSummary = (d: MovieDetails): MovieSummary => ({ ...d, genre_ids: d.genres.map((g) => g.id) });

/** Your match % and the reason for one title (same scoring as Tonight's pick, no mood). */
export function useMatchFor(details?: MovieDetails) {
  const profile = useTasteProfile();
  const collab = useCollab(profile);
  return useMemo(
    () => (details ? scoreMovie(asSummary(details), { profile, collab }) : undefined),
    [details, profile, collab],
  );
}

/** TMDB's "also liked" list for this title, re-ranked for you and minus what you've seen or hidden. */
export function useMoreLikeThis(id?: number) {
  const profile = useTasteProfile();
  const query = useQuery({
    queryKey: ["recommendations", id],
    queryFn: ({ signal }) => getRecommendations(id!, signal),
    enabled: isValidId(id),
    staleTime: 6 * 60 * 60_000,
  });
  const recs = useMemo(() => (query.data ? recommend(query.data.results, { profile }) : []), [query.data, profile]);
  return { ...query, recs };
}

/** Poster accent colour, sampled from the tiny w92 poster and cached for the session. */
export function useAccent(posterPath?: string | null) {
  const uri = tmdbImage(posterPath, "w92");
  const { data } = useQuery({
    queryKey: ["accent", uri],
    queryFn: () => extractAccent(uri!),
    enabled: !!uri,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? FALLBACK_ACCENT;
}
