import { useState } from "react";
import { View } from "react-native";
import { toLite } from "@shared/taste";
import { MOODS } from "@shared/moods";
import { dayPart, formatDuration } from "@shared/time";
import { ErrorCard } from "@/components/Feedback";
import { PosterRow } from "@/components/Posters";
import { Screen } from "@/components/Screen";
import { MoodChips } from "@/components/home/MoodChips";
import { TimeSlider } from "@/components/home/TimeSlider";
import { TonightPick, type NextAction } from "@/components/home/TonightPick";
import { useRecommendations } from "@/hooks/tmdb";
import { useDebounced, useNow } from "@/hooks/useUtils";
import { useVibeStore } from "@/store/vibe";
import { useToast } from "@/store/ui";

/** Tonight: pick a mood and a time budget, get one great pick plus a row of alternatives. */
export default function TonightScreen() {
  const mood = useVibeStore((s) => s.mood);
  const minutes = useVibeStore((s) => s.minutes);
  const maxRuntime = useDebounced(minutes, 350); // don't hit TMDB on every slider step
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
    <Screen title="What's the vibe?" eyebrow={dayPart(now)} ambient={{ path: pick?.movie.backdrop_path, fallback: false }}>
      <View style={{ gap: 12, paddingTop: 4 }}>
        <MoodChips />
        <TimeSlider />
        {results.isError ? (
          <View style={{ paddingHorizontal: 16 }}>
            <ErrorCard error={results.error} onRetry={results.refetch} />
          </View>
        ) : (
          <TonightPick rec={pick} loading={results.isLoading} refreshing={results.isPlaceholderData} onNext={next} />
        )}
        {!results.isError && (
          <PosterRow
            title={`More ${MOODS[mood].label.toLowerCase()} picks`}
            subtitle={`Ranked for you · all under ${formatDuration(maxRuntime)} · streaming or rentable in India`}
            loading={results.isLoading}
            movies={rest.map((r) => r.movie)}
          />
        )}
      </View>
    </Screen>
  );
}
