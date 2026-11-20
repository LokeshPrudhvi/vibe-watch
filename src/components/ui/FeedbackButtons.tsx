import { motion } from "motion/react";
import { Bookmark, Eye, Heart, ThumbsDown, type LucideIcon } from "lucide-react";
import type { MarkType, MovieLite } from "@/lib/recommend";
import { isReleased } from "@/lib/tmdb";
import { useMarked, useVibeStore } from "@/store/useVibeStore";
import { useToast } from "@/store/useToast";

const ACTIONS: { type: MarkType; label: string; on: string; icon: LucideIcon; toast?: string; needsRelease?: boolean }[] = [
  { type: "like", label: "Love", on: "Loved", icon: Heart, needsRelease: true },
  { type: "save", label: "Save", on: "Saved", icon: Bookmark },
  { type: "seen", label: "Seen it", on: "Seen", icon: Eye, toast: "Marked as seen. We won't suggest it again.", needsRelease: true },
  { type: "dislike", label: "Not for me", on: "Hidden", icon: ThumbsDown, toast: "Got it. Less like this from now on." },
];

/**
 * Love / Save / Seen / Not for me: the explicit feedback that trains the recommender.
 * A film that isn't out yet can only be saved or dismissed: nobody has seen or loved it.
 */
export function FeedbackButtons({ movie, compact }: { movie: MovieLite; compact?: boolean }) {
  const mark = useVibeStore((s) => s.mark);
  const unmark = useVibeStore((s) => s.unmark);
  const show = useToast((s) => s.show);
  const marks = useVibeStore((s) => s.marks);
  const released = isReleased(movie.date, movie.status);
  // keep an already-set Love/Seen visible on unreleased titles so it can still be undone
  const visible = ACTIONS.filter(
    (a) => released || !a.needsRelease || marks.some((m) => m.type === a.type && m.movie.id === movie.id),
  );

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) => (
        <FeedbackButton
          key={a.type}
          action={a}
          id={movie.id}
          compact={compact}
          onToggle={(active) => {
            if (active) return unmark(a.type, movie.id);
            // snapshot so Undo restores whatever this replaced (e.g. a Save cleared by Seen)
            const before = useVibeStore.getState().marks;
            mark(a.type, movie);
            if (a.toast) show(a.toast, () => useVibeStore.setState({ marks: before }));
          }}
        />
      ))}
    </div>
  );
}

function FeedbackButton({
  action,
  id,
  compact,
  onToggle,
}: {
  action: (typeof ACTIONS)[number];
  id: number;
  compact?: boolean;
  onToggle: (active: boolean) => void;
}) {
  const active = useMarked(action.type, id);
  const Icon = action.icon;
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      aria-pressed={active}
      aria-label={action.label}
      title={action.label}
      onClick={() => onToggle(active)}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-inverse" : "bg-tint/8 text-ink hover:bg-tint/14"
      }`}
    >
      <Icon className={`size-4 ${active && action.type === "like" ? "fill-current" : ""}`} />
      {!compact && <span>{active ? action.on : action.label}</span>}
    </motion.button>
  );
}
