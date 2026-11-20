import { PageHeader } from "@/components/layout/PageHeader";
import { PosterRow } from "@/components/home/PosterRow";
import { PosterCard } from "@/components/home/PosterCard";
import { useBecauseYouLiked, useMoodRow, useTasteProfile, useTrending } from "@/hooks/useTmdb";
import { useDocumentTitle } from "@/hooks/useUtils";
import { MOODS, MOOD_ORDER, type MoodId } from "@/lib/moods";

export default function ExplorePage() {
  useDocumentTitle("Explore");
  const trending = useTrending();
  const { hidden } = useTasteProfile();
  const because = useBecauseYouLiked();

  return (
    <>
      <PageHeader title="Explore" />
      <div className="space-y-8 px-4 pt-2 md:px-8">
        {because.seed && (because.isLoading || because.movies.length > 0) && (
          <PosterRow
            title={`Because you liked ${because.seed.title}`}
            subtitle="People with your taste also loved these"
            loading={because.isLoading}
          >
            {because.movies.map((m) => (
              <PosterCard key={m.id} movie={m} section="because" />
            ))}
          </PosterRow>
        )}

        {!trending.isError && (
          <PosterRow title="Trending this week" subtitle="What everyone's watching" loading={trending.isLoading}>
            {trending.data
              ?.filter((m) => !hidden.has(m.id))
              .map((m) => <PosterCard key={m.id} movie={m} section="trending" />)}
          </PosterRow>
        )}

        {MOOD_ORDER.map((id) => (
          <MoodRow key={id} id={id} />
        ))}
      </div>
    </>
  );
}

function MoodRow({ id }: { id: MoodId }) {
  const { recs, isLoading, isError } = useMoodRow(id);
  if (isError) return null;
  return (
    <PosterRow title={MOODS[id].label} subtitle={`${MOODS[id].tagline} · ranked for you`} loading={isLoading}>
      {recs.map((r) => (
        <PosterCard key={r.movie.id} movie={r.movie} section={`explore-${id}`} />
      ))}
    </PosterRow>
  );
}
