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
import { toLite, useVibeStore } from "@/store/useVibeStore";
import { useToast } from "@/store/useToast";
import type { NextAction } from "@/components/home/TonightPick";
import { useState } from "react";
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

  // Ranked on-device. Swiping past a pick sets it aside for this visit, so "next" is always new;
  // a skip also nudges it down for a few days, a save adds it to the Library.
  const results = useRecommendations(mood, maxRuntime);
  const [passed, setPassed] = useState<number[]>([]);
  const [pick, ...rest] = results.recs.filter((r) => !passed.includes(r.movie.id));
  const mark = useVibeStore((s) => s.mark);
  const unmark = useVibeStore((s) => s.unmark);
  const signal = useVibeStore((s) => s.signal);
  const toast = useToast((s) => s.show);

  const next = (action: NextAction) => {
    if (!pick) return;
    const movie = pick.movie;
    const lite = toLite(movie);
    if (action === "save") {
      mark("save", lite);
      toast(`Saved ${movie.title} to your Library`, () => {
        unmark("save", movie.id);
        setPassed((p) => p.filter((id) => id !== movie.id));
      });
    } else {
      signal("skip", lite);
    }
    setPassed((p) => [...p, movie.id]);
  };

  return (
    <>
      <PageHeader eyebrow={dayPart(now)} title="What's the vibe?" />
      <div className="space-y-6 px-4 pt-2 md:space-y-8 md:px-8">
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
              <TonightPick rec={pick} loading={results.isLoading} refreshing={results.isPlaceholderData} onNext={next} />
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
