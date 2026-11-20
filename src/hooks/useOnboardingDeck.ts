import { useEffect, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { discoverClassics, tmdbImage } from "@/lib/tmdb";
import { DECK_SIZE, ONBOARDING_SOURCES, buildOnboardingDeck } from "../../shared/onboarding";
import { useVibeStore } from "@/store/useVibeStore";

/**
 * The first-run deck: famous films across world and Indian cinema, as varied as possible.
 * Built once when the data lands, so swiping (which changes marks) never reshuffles it.
 */
export function useOnboardingDeck() {
  const results = useQueries({
    queries: ONBOARDING_SOURCES.map((s) => ({
      queryKey: ["classics", s.key],
      queryFn: ({ signal }: { signal: AbortSignal }) => discoverClassics({ language: s.language, page: s.page }, signal),
      staleTime: 24 * 60 * 60_000,
    })),
  });

  const loading = results.some((r) => r.isLoading);
  const failed = !loading && results.every((r) => r.isError);
  const stamp = results.map((r) => r.dataUpdatedAt).join("|");

  const deck = useMemo(() => {
    if (loading) return [];
    // read marks once (not reactively): titles you've already judged don't need a card
    const judged = new Set(useVibeStore.getState().marks.map((m) => m.movie.id));
    const pool = results.flatMap((r) => r.data?.results ?? []).filter((m) => !judged.has(m.id));
    return buildOnboardingDeck(pool, DECK_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, loading]);

  // warm the image cache so every card is instant
  useEffect(() => {
    for (const m of deck) {
      const img = new Image();
      img.decoding = "async";
      img.src = tmdbImage(m.poster_path, "w500")!;
    }
  }, [deck]);

  return { deck, loading, failed, retry: () => results.forEach((r) => r.refetch()) };
}
