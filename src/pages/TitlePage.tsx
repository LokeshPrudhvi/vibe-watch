import { useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CalendarClock,
  Clapperboard,
  EyeOff,
  Moon,
  Play,
  ShieldCheck,
  Star,
  Tv,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { isValidId, useMatchFor, useMoreLikeThis, useMovieFull } from "@/hooks/useTmdb";
import { usePosterAccent } from "@/hooks/usePosterAccent";
import { useDocumentTitle, useNow } from "@/hooks/useUtils";
import {
  ApiError,
  certification,
  isReleased,
  pickTrailer,
  providerGroups,
  releaseLabel,
  tmdbImage,
  todayISO,
  yearOf,
  type MovieDetails,
  type Provider,
} from "@/lib/tmdb";
import { addMinutes, formatClock, formatDuration } from "@/lib/time";
import { INDIAN_LANGUAGES, languageLabel } from "@/lib/languages";
import { useMotionSpeed } from "@/lib/motion";
import { toLite } from "@/store/useVibeStore";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { FeedbackButtons } from "@/components/ui/FeedbackButtons";
import { MatchRing } from "@/components/ui/MatchRing";
import { Skeleton } from "@/components/ui/Skeleton";
import { TrailerModal } from "@/components/ui/TrailerModal";
import { PosterRow } from "@/components/home/PosterRow";
import { PosterCard } from "@/components/home/PosterCard";
import NotFoundPage from "@/pages/NotFoundPage";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export default function TitlePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { layoutId?: string; poster?: string | null };
  const speed = useMotionSpeed();
  const movieId = Number(id);
  const valid = isValidId(movieId);
  const { data, error, isError, isLoading, refetch } = useMovieFull(valid ? movieId : undefined);
  const notFound = !valid || (error instanceof ApiError && error.status === 404);
  useDocumentTitle(notFound ? "Title not found" : data?.title);

  const poster = state.poster ?? data?.poster_path;
  const accent = usePosterAccent(poster);
  const layoutId = state.layoutId ?? `poster-direct-${id}`;
  // Opened from a shared link → there's no in-app history to go back to.
  const goBack = () => (location.key === "default" ? navigate("/") : navigate(-1));
  const [trailerOpen, setTrailerOpen] = useState(false);

  if (notFound) {
    return (
      <div className="min-h-dvh bg-base pt-16">
        <BackButton onClick={goBack} />
        <NotFoundPage title="Title not found" note="We couldn't find that movie. It may have been removed from TMDB." />
      </div>
    );
  }

  const released = data ? isReleased(data.release_date, data.status) : true;
  const trailer = pickTrailer(data?.videos);

  return (
    <div
      className="accent-scope relative isolate min-h-dvh overflow-x-hidden bg-base pb-16"
      style={{ "--accent": accent } as CSSProperties}
    >
      {/* cinematic backdrop fading into the page */}
      {data?.backdrop_path && (
        <img
          aria-hidden
          alt=""
          src={tmdbImage(data.backdrop_path, "w1280")}
          className="absolute inset-x-0 top-0 -z-10 h-[58vh] w-full object-cover opacity-60"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[58vh]"
        style={{
          background:
            "radial-gradient(90% 60% at 20% 0%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%), linear-gradient(to bottom, color-mix(in oklab, var(--color-base) 25%, transparent), color-mix(in oklab, var(--color-base) 80%, transparent) 60%, var(--color-base))",
        }}
      />

      <BackButton onClick={goBack} />

      <div className="mx-auto max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+4.5rem)] md:px-8 md:pt-32">
        {isError && <ErrorCard error={error} onRetry={() => refetch()} />}

        {/* ---------- hero ---------- */}
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-8">
          {poster ? (
            <motion.img
              layoutId={layoutId}
              src={tmdbImage(poster, "w500")}
              alt={data ? `${data.title} poster` : ""}
              className="poster-glow aspect-[2/3] w-[56%] max-w-[260px] shrink-0 rounded-[28px] object-cover md:w-64"
              transition={speed({ type: "spring", stiffness: 260, damping: 30 })}
            />
          ) : (
            isLoading && <Skeleton className="aspect-[2/3] w-[56%] max-w-[260px] rounded-[28px] md:w-64" />
          )}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={speed({ delay: 0.15 })}
            className="min-w-0 text-center md:text-left"
          >
            {data && <Hero data={data} released={released} />}
            {isLoading && !data && (
              <div className="space-y-3">
                <Skeleton className="mx-auto h-10 w-64 md:mx-0" />
                <Skeleton className="mx-auto h-4 w-40 md:mx-0" />
              </div>
            )}
          </motion.div>
        </div>

        {data && (
          <>
            <Actions
              data={data}
              hasTrailer={!!trailer}
              onTrailer={() => setTrailerOpen(true)}
            />
            <ScoreTiles data={data} released={released} />
            <WhereToWatch data={data} released={released} />
            {data.overview && (
              <Section title="Story">
                <p className="max-w-3xl text-[15px] leading-relaxed text-ink/85">{data.overview}</p>
              </Section>
            )}
            <Themes data={data} />
            <Cast data={data} />
            <MoreLikeThis id={data.id} />
            <p className="mt-12 text-[11px] leading-relaxed text-muted">
              Data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
              Streaming availability by JustWatch.
            </p>
          </>
        )}
      </div>

      {data && (
        <TrailerModal open={trailerOpen} videoKey={trailer?.key} title={data.title} onClose={() => setTrailerOpen(false)} />
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function Hero({ data, released }: { data: MovieDetails; released: boolean }) {
  const rating = certification(data);
  return (
    <>
      {!released && (
        <span className="accent-chip mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
          <CalendarClock className="size-3.5" /> Coming {releaseLabel(data.release_date)}
        </span>
      )}
      <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{data.title}</h1>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted md:justify-start">
        {yearOf(data.release_date) && <span>{yearOf(data.release_date)}</span>}
        {data.runtime ? <span>· {formatDuration(data.runtime)}</span> : null}
        {data.original_language ? <span>· {languageLabel(data.original_language)}</span> : null}
        {rating && <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1 ring-tint/25">{rating.cert}</span>}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5 md:justify-start">
        {data.genres.slice(0, 4).map((g) => (
          <span key={g.id} className="rounded-full bg-tint/8 px-2.5 py-1 text-xs text-ink/80">
            {g.name}
          </span>
        ))}
      </div>
      {data.tagline && <p className="accent-text mt-3 font-semibold italic">{data.tagline}</p>}
    </>
  );
}

function Actions({ data, hasTrailer, onTrailer }: { data: MovieDetails; hasTrailer: boolean; onTrailer: () => void }) {
  const match = useMatchFor(data);
  return (
    <div className="mt-7 flex flex-col items-center gap-4 md:items-start">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {match && <MatchRing value={match.match} />}
        <motion.button
          whileTap={{ scale: 0.95 }}
          disabled={!hasTrailer}
          onClick={onTrailer}
          className="accent-btn inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-bold transition disabled:opacity-40"
        >
          <Play className="size-4 fill-current" /> {hasTrailer ? "Trailer" : "No trailer yet"}
        </motion.button>
      </div>
      {match && (
        <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink/85">
          <Wand2 className="size-3.5" /> {match.reason}
        </p>
      )}
      <FeedbackButtons movie={toLite(data)} />
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[22px] bg-card p-4 ring-1 ring-tint/5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-2 truncate font-display text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

function ScoreTiles({ data, released }: { data: MovieDetails; released: boolean }) {
  const now = useNow();
  const match = useMatchFor(data);
  const rating = certification(data);
  const enoughVotes = data.vote_count >= 10;
  const daysToGo = data.release_date
    ? Math.max(0, Math.round((Date.parse(data.release_date) - Date.parse(todayISO(now))) / 86_400_000))
    : undefined;

  return (
    <section aria-label="Scores" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        icon={Star}
        label="TMDB"
        value={enoughVotes ? `${data.vote_average.toFixed(1)}★` : "—"}
        sub={enoughVotes ? `${compact.format(data.vote_count)} votes` : "Not enough votes yet"}
      />
      <Tile icon={Wand2} label="Your match" value={match ? `${match.match}%` : "—"} sub={match?.reason} />
      {released ? (
        <Tile
          icon={Moon}
          label="Done by"
          value={data.runtime ? formatClock(addMinutes(now, data.runtime)) : "—"}
          sub={data.runtime ? `If you start now · ${formatDuration(data.runtime)}` : "Runtime unknown"}
        />
      ) : (
        <Tile
          icon={CalendarClock}
          label="Release"
          value={releaseLabel(data.release_date)}
          sub={daysToGo !== undefined ? `In ${daysToGo} day${daysToGo === 1 ? "" : "s"}` : data.status}
        />
      )}
      <Tile
        icon={ShieldCheck}
        label="Rated"
        value={rating?.cert ?? "—"}
        sub={rating ? (rating.region === "IN" ? "India (CBFC)" : "US rating") : "Not rated yet"}
      />
    </section>
  );
}

function ProviderList({ title, icon: Icon, list }: { title: string; icon: LucideIcon; list: Provider[] }) {
  if (!list.length) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon className="size-3.5" /> {title}
      </p>
      <ul className="flex flex-wrap gap-2">
        {list.map((p) => (
          <li key={p.provider_id} className="inline-flex items-center gap-2 rounded-full bg-tint/6 py-1 pl-1 pr-3.5">
            <img src={tmdbImage(p.logo_path, "w92")} alt="" className="size-8 rounded-full object-cover" />
            <span className="text-sm font-semibold">{p.provider_name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhereToWatch({ data, released }: { data: MovieDetails; released: boolean }) {
  const { stream, rent, buy, link } = providerGroups(data);
  const none = !stream.length && !rent.length && !buy.length;
  return (
    <Section title="Where to watch in India">
      <div className="space-y-4 rounded-[24px] bg-card p-5 ring-1 ring-tint/5">
        {none ? (
          <p className="text-sm text-muted">
            {released
              ? "Not streaming, rentable or for sale in India right now."
              : "Not out yet. Save it and it'll be waiting in your Library."}
          </p>
        ) : (
          <>
            <ProviderList title="Stream" icon={Tv} list={stream} />
            <ProviderList title="Rent" icon={Clapperboard} list={rent} />
            <ProviderList title="Buy" icon={Clapperboard} list={buy} />
          </>
        )}
        {!none && data.original_language && INDIAN_LANGUAGES.has(data.original_language) && (
          <p className="text-xs leading-relaxed text-muted">
            Made in {languageLabel(data.original_language)}. Indian releases often stream with dubbed audio too
            (Hindi, Tamil, Telugu, Malayalam…). Our data doesn't list audio languages, so check the audio options
            in the app.
          </p>
        )}
        {link && !none && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Prices and links on TMDB · availability by JustWatch
          </a>
        )}
      </div>
    </Section>
  );
}

/** Keywords often give the plot away ("twist ending", "death of …"), so they start hidden. */
function Themes({ data }: { data: MovieDetails }) {
  const [revealed, setRevealed] = useState(false);
  const words = data.keywords?.keywords.slice(0, 14) ?? [];
  if (!words.length) return null;
  return (
    <Section title="Themes">
      <div className="relative">
        <ul
          aria-hidden={!revealed}
          className={`flex flex-wrap gap-1.5 transition-[filter] duration-(--dur-slow) ${revealed ? "" : "select-none blur-[6px]"}`}
        >
          {words.map((k) => (
            <li key={k.id} className="rounded-full bg-tint/8 px-3 py-1 text-xs font-medium capitalize">
              {k.name}
            </li>
          ))}
        </ul>
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="glass absolute inset-0 m-auto flex h-11 w-fit items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <EyeOff className="size-4" /> Spoiler shield · tap to show
          </button>
        )}
      </div>
    </Section>
  );
}

function Cast({ data }: { data: MovieDetails }) {
  const cast = (data.credits?.cast ?? []).slice().sort((a, b) => a.order - b.order).slice(0, 15);
  const directors = (data.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
  if (!cast.length && !directors.length) return null;
  return (
    <Section title="Cast & crew" subtitle={directors.length ? `Directed by ${directors.join(", ")}` : undefined}>
      <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {cast.map((c) => (
          <li key={c.id} className="w-24 shrink-0">
            {c.profile_path ? (
              <img
                src={tmdbImage(c.profile_path, "w185")}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-full bg-card object-cover ring-1 ring-tint/5"
              />
            ) : (
              <div className="grid aspect-square w-full place-items-center rounded-full bg-card font-display text-2xl font-bold text-muted ring-1 ring-tint/5">
                {c.name[0]}
              </div>
            )}
            <p className="mt-2 truncate text-center text-xs font-semibold">{c.name}</p>
            <p className="truncate text-center text-[11px] text-muted">{c.character}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MoreLikeThis({ id }: { id: number }) {
  const { recs, isLoading, isError } = useMoreLikeThis(id);
  if (isError || (!isLoading && !recs.length)) return null;
  return (
    <div className="mt-10">
      <PosterRow title="More like this" subtitle="Ranked for your taste" loading={isLoading}>
        {recs.map((r) => (
          <PosterCard key={r.movie.id} movie={r.movie} section={`more-${id}`} />
        ))}
      </PosterRow>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-10">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      className="glass fixed left-4 top-[max(env(safe-area-inset-top),1rem)] z-20 grid size-11 place-items-center rounded-full"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
