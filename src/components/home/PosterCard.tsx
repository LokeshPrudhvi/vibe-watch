import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { isReleased, releaseLabel, tmdbImage, type MovieSummary } from "@/lib/tmdb";
import { languageLabel } from "@/lib/languages";
import { toLite, useVibeStore } from "@/store/useVibeStore";

interface Props {
  movie: MovieSummary;
  /** prefix so the same movie in two rows gets two distinct layoutIds */
  section: string;
  badge?: ReactNode;
  footer?: ReactNode;
  /** fill the grid cell instead of the fixed row width */
  fluid?: boolean;
  /** show the original language under the title (search results) */
  showLanguage?: boolean;
}

export function PosterCard({ movie, section, badge, footer, fluid, showLanguage }: Props) {
  const navigate = useNavigate();
  const signal = useVibeStore((s) => s.signal);
  const layoutId = `poster-${section}-${movie.id}`;

  return (
    <button
      onClick={() => {
        signal("open", toLite(movie));
        navigate(`/title/movie/${movie.id}`, { state: { layoutId, poster: movie.poster_path } });
      }}
      className={`group text-left ${fluid ? "w-full" : "w-32 shrink-0 snap-start sm:w-36 md:w-40"}`}
    >
      <div className="relative transition-transform duration-(--dur-slow) group-hover:-translate-y-1">
        <motion.img
          layoutId={layoutId}
          src={tmdbImage(movie.poster_path, "w342")}
          alt={`${movie.title} poster`}
          loading="lazy"
          className="aspect-[2/3] w-full rounded-2xl bg-card object-cover ring-1 ring-tint/5 transition group-hover:ring-tint/20"
        />
        {badge}
      </div>
      <p className="mt-2 truncate text-sm font-semibold">{movie.title}</p>
      {footer ?? <Meta movie={movie} showLanguage={showLanguage} />}
    </button>
  );
}

function Meta({ movie, showLanguage }: { movie: MovieSummary; showLanguage?: boolean }) {
  const parts = [
    showLanguage && movie.original_language ? languageLabel(movie.original_language) : undefined,
    isReleased(movie.release_date) ? undefined : `Coming ${releaseLabel(movie.release_date)}`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <p className="truncate text-[11px] font-medium text-muted">{parts.join(" · ")}</p>;
}
