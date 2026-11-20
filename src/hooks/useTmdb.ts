import { useMemo, useRef } from "react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import {
  discoverByLanguage,
  discoverByVibe,
  getMovie,
  getMovieFull,
  getRecommendations,
  getTrending,
  searchMovies,
  type DiscoverOptions,
  type MovieDetails,
  type MovieSummary,
} from "@/lib/tmdb";
import { MOODS, type MoodId } from "@/lib/moods";
import { splitByLanguage } from "@/lib/languages";
import {
  buildCollab,
  buildCrowd,
  buildProfile,
  recommend,
  scoreMovie,
  type CrowdMap,
  type PeopleMap,
  type Recommendation,
  type TasteProfile,
} from "@/lib/recommend";
import { useVibeStore } from "@/store/useVibeStore";
import { accountApi, useCrowdItems } from "@/hooks/useAccountSync";

export const isValidId = (id: unknown): id is number => Number.isInteger(id) && (id as number) > 0;

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
  const pages = lang ? [1, 2, 3] : [1];
  const results = useQueries({
    queries: pages.map((page) => ({
      queryKey: ["search", q.toLowerCase(), page],
      queryFn: ({ signal }: { signal: AbortSignal }) => searchMovies(q, page, signal),
      enabled: q.length >= 2,
      placeholderData: keepPreviousData,
      staleTime: 60 * 60_000,
    })),
  });
  const stamp = results.map((r) => r.dataUpdatedAt).join("|");
  const { primary, others } = useMemo(() => {
    const seen = new Set<number>();
    const all = results
      .flatMap((r) => r.data?.results ?? [])
      .filter((m) => {
        if (!m.poster_path || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    return splitByLanguage(all, lang);
  }, [stamp, lang]);
  const first = results[0];
  return {
    /** made in the chosen language (or everything, with no language picked) */
    primary,
    /** matches in other languages: shown separately, since they may have dubs TMDB doesn't list */
    others,
    isLoading: results.some((r) => r.isLoading),
    isError: first.isError,
    error: first.error,
    isPlaceholderData: results.some((r) => r.isPlaceholderData),
    refetch: () => results.forEach((r) => r.refetch()),
  };
}

/** Browse a language: popular films in it (available in India), ranked for your taste. */
export function useLanguageBrowse(lang?: string) {
  const profile = useTasteProfile();
  const results = useQueries({
    queries: (lang ? [1, 2] : []).map((page) => ({
      queryKey: ["discover-language", lang, page],
      queryFn: ({ signal }: { signal: AbortSignal }) => discoverByLanguage(lang!, page, signal),
      staleTime: 30 * 60_000,
    })),
  });
  const stamp = results.map((r) => r.dataUpdatedAt).join("|");
  const recs = useMemo(
    () => recommend(results.flatMap((r) => r.data?.results ?? []), { profile }),
    [stamp, profile],
  );
  return {
    recs,
    isLoading: results.some((r) => r.isLoading),
    isError: results[0]?.isError ?? false,
    error: results[0]?.error,
    refetch: () => results.forEach((r) => r.refetch()),
  };
}

/** The user's taste profile, rebuilt whenever they interact. */
/**
 * Cast & directors for many movies (server-cached TMDB credits). Never throws: without the
 * server's people endpoint the recommender just ignores cast and crew.
 */
export function usePeople(ids: number[], enabled = true) {
  const key = [...new Set(ids.filter((n) => isValidId(n)))].sort((a, b) => a - b).slice(0, 120);
  return useQuery({
    queryKey: ["people", key.join(",")],
    queryFn: async (): Promise<PeopleMap> => {
      try {
        return (await accountApi<{ people: PeopleMap }>("/api/movies/people", { method: "POST", body: JSON.stringify({ ids: key }) })).people;
      } catch {
        return {};
      }
    },
    enabled: enabled && key.length > 0,
    staleTime: 24 * 60 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** The user's taste profile, rebuilt whenever they interact; includes favourite cast & directors. */
export function useTasteProfile(): TasteProfile {
  const marks = useVibeStore((s) => s.marks);
  const signals = useVibeStore((s) => s.signals);
  // the titles that shape taste: everything marked, plus recently opened/trailered/skipped
  const ids = useMemo(() => {
    const out = marks.map((m) => m.movie.id);
    for (const s of signals) if (s.id && out.length < 120) out.push(s.id);
    return out;
  }, [marks, signals]);
  const people = usePeople(ids);
  return useMemo(() => buildProfile(marks, signals, Date.now(), people.data), [marks, signals, people.data]);
}

/** What our users with your taste loved (server). Empty map unless signed in + sharing. */
export function useCrowd(): CrowdMap | undefined {
  const items = useCrowdItems();
  const marks = useVibeStore((s) => s.marks);
  return useMemo(() => {
    if (!items.data?.length) return undefined;
    const titles = Object.fromEntries(marks.map((m) => [m.movie.id, m.movie.title]));
    return buildCrowd(items.data, titles);
  }, [items.data, marks]);
}

/** TMDB "also liked" lists for your top seeds → collaborative signal. */
export function useCollab(profile: TasteProfile, max = 3) {
  const seeds = profile.seeds.slice(0, max);
  const lists = useQueries({
    queries: seeds.map((s) => ({
      queryKey: ["recommendations", s.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => getRecommendations(s.id, signal),
      staleTime: 6 * 60 * 60_000,
    })),
  });
  const stamp = lists.map((l) => l.dataUpdatedAt).join("|") + seeds.map((s) => `${s.id}:${s.weight.toFixed(2)}`).join("|");
  return useMemo(() => buildCollab(seeds, lists.map((l) => l.data?.results ?? [])), [stamp]);
}

/**
 * Personalised, time-fitting, India-available picks for a mood.
 * Candidates come from several discover queries (mood × popular/acclaimed × your language),
 * then get ranked on-device by lib/recommend.
 */
export function useRecommendations(moodId: MoodId, maxRuntime: number) {
  const mood = MOODS[moodId];
  const profile = useTasteProfile();
  const collab = useCollab(profile);
  const crowd = useCrowd();

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

  const results = useQueries({
    queries: sources.map((s) => ({
      queryKey: ["discover", moodId, maxRuntime, ...s.key],
      queryFn: ({ signal }: { signal: AbortSignal }) => discoverByVibe(mood, maxRuntime, s.opts, signal),
      placeholderData: keepPreviousData,
    })),
  });

  // Rank only once every source (and their cast data) has answered, otherwise the pick
  // flips as each piece lands.
  const sourcesSettled = results.every((r) => !r.isLoading && !r.isPlaceholderData);
  const stamp = results.map((r) => `${r.dataUpdatedAt}:${r.isPlaceholderData ? 1 : 0}`).join("|");
  const pool = useMemo(
    () => results.flatMap((r) => r.data?.results ?? []).filter((m: MovieSummary) => m.backdrop_path),
    [stamp],
  );
  const poolPeople = usePeople(pool.map((m) => m.id), sourcesSettled);
  const settled = sourcesSettled && !poolPeople.isLoading && !poolPeople.isPlaceholderData;
  const lastSettled = useRef<Recommendation[]>([]);
  const recs = useMemo(() => {
    if (!settled && lastSettled.current.length) return lastSettled.current;
    const ranked = recommend(pool, { mood, profile, collab, crowd, people: poolPeople.data });
    if (settled) lastSettled.current = ranked;
    return ranked;
  }, [pool, settled, profile, collab, crowd, poolPeople.data, mood]);

  const primary = results[0];
  return {
    recs,
    isLoading: results.some((r) => r.isLoading) && !lastSettled.current.length,
    isError: primary.isError,
    error: primary.error,
    isPlaceholderData: primary.isPlaceholderData,
    refetch: () => results.forEach((r) => r.refetch()),
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
  const crowd = useCrowd();
  // the detail payload already carries credits; shape them like /api/movies/people
  const people = useMemo<PeopleMap | undefined>(() => {
    if (!details?.credits) return undefined;
    const top = [...details.credits.cast].sort((a, b) => a.order - b.order).slice(0, 6);
    return {
      [details.id]: {
        directors: details.credits.crew.filter((c) => c.job === "Director").map(({ id, name }) => ({ id, name })),
        cast: top.map(({ id, name }) => ({ id, name })),
      },
    };
  }, [details]);
  return useMemo(
    () => (details ? scoreMovie(asSummary(details), { profile, collab, crowd, people }) : undefined),
    [details, profile, collab, crowd, people],
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
  const crowd = useCrowd();
  const people = usePeople(query.data?.results.map((m) => m.id) ?? []);
  const recs = useMemo(
    () => (query.data ? recommend(query.data.results, { profile, crowd, people: people.data }) : []),
    [query.data, profile, crowd, people.data],
  );
  return { ...query, recs };
}
