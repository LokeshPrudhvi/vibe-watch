import { View } from "react-native";
import { MOODS } from "@shared/moods";
import { dayPart, formatDuration } from "@shared/time";
import { ErrorCard } from "@/components/Feedback";
import { PosterRow } from "@/components/Posters";
import { Screen } from "@/components/Screen";
import { MoodChips } from "@/components/home/MoodChips";
import { TimeSlider } from "@/components/home/TimeSlider";
import { TonightPick } from "@/components/home/TonightPick";
import { useRecommendations } from "@/hooks/tmdb";
import { useDebounced, useNow } from "@/hooks/useUtils";
import { useVibeStore } from "@/store/vibe";

/** Tonight: pick a mood and a time budget, get one great pick plus a row of alternatives. */
export default function TonightScreen() {
  const mood = useVibeStore((s) => s.mood);
  const minutes = useVibeStore((s) => s.minutes);
  const maxRuntime = useDebounced(minutes, 350); // don't hit TMDB on every slider step
  const now = useNow(60_000);

  // Ranked on-device: Shuffle records a skip, which re-ranks and promotes the next best fit.
  const results = useRecommendations(mood, maxRuntime);
  const [pick, ...rest] = results.recs;

  return (
    <Screen title="What's the vibe?" eyebrow={dayPart(now)}>
      <View style={{ gap: 28, paddingTop: 4 }}>
        <MoodChips />
        <TimeSlider />
        {results.isError ? (
          <View style={{ paddingHorizontal: 16 }}>
            <ErrorCard error={results.error} onRetry={results.refetch} />
          </View>
        ) : (
          <TonightPick rec={pick} loading={results.isLoading} refreshing={results.isPlaceholderData} />
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
