import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Clapperboard, Moon, Play, Shuffle, Sparkles, Star, Tv, Wand2 } from "lucide-react";
import { useMovie } from "@/hooks/useTmdb";
import { usePosterAccent } from "@/hooks/usePosterAccent";
import { useNow } from "@/hooks/useUtils";
import { availability, pickTrailer, tmdbImage, yearOf } from "@/lib/tmdb";
import { GENRES } from "@/lib/moods";
import type { Recommendation } from "@/lib/recommend";
import { useMotionSpeed } from "@/lib/motion";
import { addMinutes, formatClock, formatDuration } from "@/lib/time";
import { toLite, useVibeStore } from "@/store/useVibeStore";
import { FeedbackButtons } from "@/components/ui/FeedbackButtons";
import { MatchRing } from "@/components/ui/MatchRing";
import { Skeleton } from "@/components/ui/Skeleton";
import { TrailerModal } from "@/components/ui/TrailerModal";

interface Props {
  rec?: Recommendation;
  loading: boolean;
  refreshing: boolean;
  onShuffle?: () => void;
}

export function TonightPick({ rec, loading, refreshing, onShuffle }: Props) {
  const navigate = useNavigate();
  const signal = useVibeStore((s) => s.signal);
  const speed = useMotionSpeed();
  const movie = rec?.movie;
  const details = useMovie(movie?.id);
  const accent = usePosterAccent(movie?.poster_path);
  const now = useNow();
  const [trailerOpen, setTrailerOpen] = useState(false);

  if (loading) return <PickSkeleton />;
  if (!rec || !movie) return <EmptyPick />;

  const d = details.data;
  const trailer = pickTrailer(d?.videos);
  const { watch, rent } = availability(d);
  const lite = toLite(movie);
  const layoutId = `poster-pick-${movie.id}`;
  const open = () => {
    signal("open", lite);
    navigate(`/title/movie/${movie.id}`, { state: { layoutId, poster: movie.poster_path } });
  };

  return (
    <motion.article
      key={movie.id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: refreshing ? 0.7 : 1, y: 0 }}
      transition={speed({ duration: 0.45, ease: [0.22, 1, 0.36, 1] })}
      className="accent-scope relative isolate overflow-hidden rounded-[32px] bg-card ring-1 ring-tint/5"
      style={{ "--accent": accent } as CSSProperties}
    >
      {/* ambient poster-coloured backdrop */}
      <img
        aria-hidden
        src={tmdbImage(movie.backdrop_path, "w780")}
        alt=""
        className="absolute inset-0 -z-10 size-full scale-110 object-cover opacity-45 blur-2xl"
      />
      <div aria-hidden className="pick-wash absolute inset-0 -z-10" />

      <div className="flex flex-col gap-5 p-4 sm:p-6 md:flex-row md:items-end md:gap-7">
        <button onClick={open} className="group mx-auto w-[62%] max-w-[260px] shrink-0 md:mx-0 md:w-56" aria-label={`Open ${movie.title}`}>
          <motion.img
            layoutId={layoutId}
            src={tmdbImage(movie.poster_path, "w500")}
            alt={`${movie.title} poster`}
            className="poster-glow aspect-[2/3] w-full rounded-3xl object-cover"
          />
        </button>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="accent-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]">
              <Sparkles className="size-3.5" /> Tonight's pick
            </span>
            {d?.runtime ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tint/8 px-3 py-1 text-[11px] font-semibold">
                <Moon className="size-3.5 text-time" /> Ends {formatClock(addMinutes(now, d.runtime))}
              </span>
            ) : null}
          </div>

          <div>
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              {movie.title}
            </h2>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink/85">
              <Wand2 className="size-3.5 shrink-0" /> {rec.reason}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span>{yearOf(movie.release_date)}</span>
              {d?.runtime ? <><Dot /><span>{formatDuration(d.runtime)}</span></> : null}
              <Dot />
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 fill-feel text-feel" /> {movie.vote_average.toFixed(1)}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {movie.genre_ids.slice(0, 3).map((g) => (
              <span key={g} className="rounded-full bg-tint/6 px-2.5 py-1 text-xs text-ink/80">
                {GENRES[g] ?? "Other"}
              </span>
            ))}
          </div>

          <p className="line-clamp-3 max-w-prose text-sm leading-relaxed text-ink/75">{movie.overview}</p>

          {/* actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <MatchRing value={rec.match} />
            <motion.button
              whileTap={{ scale: 0.95 }}
              disabled={!trailer}
              onClick={() => {
                setTrailerOpen(true);
                signal("trailer", lite); // interest signal for the recommender
              }}
              className="accent-btn inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition disabled:opacity-40"
            >
              <Play className="size-4 fill-current" /> Trailer
            </motion.button>
            <AppsPill loading={details.isLoading} watch={watch} rentCount={rent.length} />
            <motion.button
              whileTap={{ scale: 0.9, rotate: -20 }}
              onClick={() => {
                signal("skip", lite); // nudges this title down for a few days
                onShuffle?.();
              }}
              aria-label="Pick something else"
              className="grid size-11 place-items-center rounded-full bg-tint/8 transition hover:bg-tint/15"
            >
              <Shuffle className="size-4" />
            </motion.button>
          </div>
          <FeedbackButtons movie={lite} />
        </div>
      </div>

      <TrailerModal open={trailerOpen} videoKey={trailer?.key} title={movie.title} onClose={() => setTrailerOpen(false)} />
    </motion.article>
  );
}

function AppsPill({
  loading,
  watch,
  rentCount,
}: {
  loading: boolean;
  watch: ReturnType<typeof availability>["watch"];
  rentCount: number;
}) {
  if (loading) return <Skeleton className="h-11 w-32 rounded-full" />;

  const label = watch.length
    ? `On ${watch.length} app${watch.length > 1 ? "s" : ""}`
    : rentCount
      ? `Rent on ${rentCount}`
      : "Not streaming in India";

  return (
    <span className="inline-flex h-11 items-center gap-2 rounded-full bg-tint/8 pl-1.5 pr-4 text-sm font-semibold">
      {watch.length ? (
        <span className="flex -space-x-2">
          {watch.slice(0, 3).map((p) => (
            <img
              key={p.provider_id}
              src={tmdbImage(p.logo_path, "w92")}
              alt={p.provider_name}
              title={p.provider_name}
              className="size-8 rounded-full object-cover ring-2 ring-card"
            />
          ))}
        </span>
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-tint/10">
          {rentCount ? <Clapperboard className="size-4" /> : <Tv className="size-4" />}
        </span>
      )}
      {label}
    </span>
  );
}

const Dot = () => <span className="size-1 rounded-full bg-muted/60" aria-hidden />;

function PickSkeleton() {
  return (
    <div className="flex flex-col gap-5 rounded-[32px] bg-card p-4 sm:p-6 md:flex-row md:items-end">
      <Skeleton className="mx-auto aspect-[2/3] w-[62%] max-w-[260px] rounded-3xl md:mx-0 md:w-56" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-3">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-12 w-28 rounded-full" />
          <Skeleton className="h-12 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function EmptyPick() {
  return (
    <div className="rounded-[32px] bg-card p-8 text-center ring-1 ring-tint/5">
      <p className="font-display text-2xl font-bold">Nothing fits just yet</p>
      <p className="mt-2 text-sm text-muted">Give yourself a little more time, or try another vibe.</p>
    </div>
  );
}
