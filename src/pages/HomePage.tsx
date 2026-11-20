import { PageHeader } from "@/components/layout/PageHeader";
import { MoodChips } from "@/components/home/MoodChips";
import { TimeSlider } from "@/components/home/TimeSlider";
import { TonightPick } from "@/components/home/TonightPick";
import { PosterRow } from "@/components/home/PosterRow";
import { PosterCard } from "@/components/home/PosterCard";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { useRecommendations } from "@/hooks/useTmdb";
import { useDebounced, useDocumentTitle, useNow } from "@/hooks/useUtils";
import { MOODS } from "@/lib/moods";
import { dayPart, formatDuration } from "@/lib/time";
import { useVibeStore } from "@/store/useVibeStore";
import { useOnboarding } from "@/store/useOnboarding";
import { Navigate } from "react-router";

export default function HomePage() {
  // brand-new (no taste yet, never onboarded) → swipe a few films first
  const needsOnboarding = useOnboarding((s) => s.status === "pending") && useVibeStore.getState().marks.length === 0;
  if (needsOnboarding) return <Navigate to="/welcome" replace />;
  return <Tonight />;
}

function Tonight() {
  useDocumentTitle();
  const mood = useVibeStore((s) => s.mood);
  const minutes = useVibeStore((s) => s.minutes);
  const maxRuntime = useDebounced(minutes, 350); // don't hit TMDB on every slider tick
  const now = useNow(60_000);

  // Ranked on-device: Shuffle records a skip, which re-ranks and promotes the next best fit.
  const results = useRecommendations(mood, maxRuntime);
  const [pick, ...rest] = results.recs;

  return (
    <>
      <PageHeader eyebrow={dayPart(now)} title="What's the vibe?" />
      <div className="space-y-8 px-4 pt-2 md:px-8">
        <MoodChips />

        {/* Time-fit sits first on phones (set the budget, then see the pick); right-hand column on desktop */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="lg:sticky lg:top-24 lg:order-2">
            <TimeSlider />
          </div>
          <div className="min-w-0 lg:order-1">
            {results.isError ? (
              <ErrorCard error={results.error} onRetry={results.refetch} />
            ) : (
              <TonightPick rec={pick} loading={results.isLoading} refreshing={results.isPlaceholderData} />
            )}
          </div>
        </div>

        {!results.isError && (
          <PosterRow
            title={`More ${MOODS[mood].label.toLowerCase()} picks`}
            subtitle={`Ranked for you · all under ${formatDuration(maxRuntime)} · streaming or rentable in India`}
            loading={results.isLoading}
          >
            {rest.map((r) => (
              <PosterCard key={r.movie.id} movie={r.movie} section="vibe" />
            ))}
          </PosterRow>
        )}
      </div>
    </>
  );
}
