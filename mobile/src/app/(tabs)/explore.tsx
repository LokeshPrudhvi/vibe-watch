import { View } from "react-native";
import { MOODS, MOOD_ORDER, type MoodId } from "@shared/moods";
import { PosterRow } from "@/components/Posters";
import { Screen } from "@/components/Screen";
import { useBecauseYouLiked, useMoodRow, useTasteProfile, useTrending } from "@/hooks/tmdb";

export default function ExploreScreen() {
  const trending = useTrending();
  const { hidden } = useTasteProfile();
  const because = useBecauseYouLiked();

  return (
    <Screen title="Explore">
      <View style={{ gap: 28, paddingTop: 4 }}>
        {because.seed && (because.isLoading || because.movies.length > 0) && (
          <PosterRow
            title={`Because you liked ${because.seed.title}`}
            subtitle="People with your taste also loved these"
            loading={because.isLoading}
            movies={because.movies}
          />
        )}
        {!trending.isError && (
          <PosterRow
            title="Trending this week"
            subtitle="What everyone's watching"
            loading={trending.isLoading}
            movies={trending.data?.filter((m) => !hidden.has(m.id))}
          />
        )}
        {MOOD_ORDER.map((id) => (
          <MoodRow key={id} id={id} />
        ))}
      </View>
    </Screen>
  );
}

function MoodRow({ id }: { id: MoodId }) {
  const { recs, isLoading, isError } = useMoodRow(id);
  if (isError) return null;
  return (
    <PosterRow
      title={MOODS[id].label}
      subtitle={`${MOODS[id].tagline} · ranked for you`}
      loading={isLoading}
      movies={recs.map((r) => r.movie)}
    />
  );
}
