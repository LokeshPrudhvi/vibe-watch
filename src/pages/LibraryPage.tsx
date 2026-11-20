import { useState } from "react";
import { useNavigate } from "react-router";
import { Bookmark, Eye, Heart, ThumbsDown, X, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Segmented } from "@/components/ui/Controls";
import { useDocumentTitle } from "@/hooks/useUtils";
import type { MarkType } from "@/lib/recommend";
import { tmdbImage } from "@/lib/tmdb";
import { useVibeStore } from "@/store/useVibeStore";

const SHELVES: { type: MarkType; label: string; icon: LucideIcon; empty: string; remove: string }[] = [
  { type: "save", label: "Saved", icon: Bookmark, empty: "Tap Save on any pick to watch it later.", remove: "Remove from Saved" },
  { type: "like", label: "Loved", icon: Heart, empty: "Movies you love teach your recommendations the most.", remove: "Unlove" },
  { type: "seen", label: "Seen", icon: Eye, empty: "Mark what you've watched and we'll stop suggesting it.", remove: "Remove from Seen" },
  { type: "dislike", label: "Hidden", icon: ThumbsDown, empty: "Titles you said aren't for you show up here.", remove: "Unhide" },
];

export default function LibraryPage() {
  useDocumentTitle("Library");
  const [shelf, setShelf] = useState<MarkType>("save");
  const marks = useVibeStore((s) => s.marks);
  const unmark = useVibeStore((s) => s.unmark);
  const navigate = useNavigate();
  const current = SHELVES.find((s) => s.type === shelf)!;
  const items = marks.filter((m) => m.type === shelf);

  return (
    <>
      <PageHeader eyebrow="Kept on this device" title="Library" />
      <div className="space-y-5 px-4 pt-2 md:px-8">
        <Segmented
          label="Shelf"
          layoutId="library-shelf"
          value={shelf}
          onChange={setShelf}
          options={SHELVES.map((s) => ({ value: s.type, label: s.label, icon: s.icon }))}
        />

        {items.length === 0 ? (
          <div className="rounded-[28px] bg-card p-8 text-center ring-1 ring-tint/5">
            <current.icon className="mx-auto size-8 text-muted" />
            <p className="mt-3 text-sm text-muted">{current.empty}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {items.map(({ movie }) => (
              <li key={movie.id} className="relative">
                <button
                  onClick={() => navigate(`/title/movie/${movie.id}`, { state: { poster: movie.poster } })}
                  className="block w-full text-left"
                >
                  <img
                    src={tmdbImage(movie.poster, "w342")}
                    alt={`${movie.title} poster`}
                    loading="lazy"
                    className="aspect-[2/3] w-full rounded-2xl bg-card object-cover ring-1 ring-tint/5"
                  />
                  <p className="mt-1.5 truncate text-xs font-semibold">{movie.title}</p>
                </button>
                <button
                  onClick={() => unmark(shelf, movie.id)}
                  aria-label={`${current.remove}: ${movie.title}`}
                  title={current.remove}
                  className="glass absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
