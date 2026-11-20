import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { Heart, X } from "lucide-react";
import { tmdbImage, yearOf, type MovieSummary } from "@/lib/tmdb";
import { GENRES } from "@/lib/moods";
import { languageLabel } from "@/lib/languages";
import { useMotionSpeed } from "@/lib/motion";
import type { SwipeDecision } from "../../../shared/onboarding";

export interface SwipeCardHandle {
  swipe: (d: SwipeDecision) => void;
}

interface Props {
  movie: MovieSummary;
  /** 0 = top card; 1, 2 = peeking behind it */
  depth: number;
  onDecide: (d: SwipeDecision) => void;
  /** live horizontal drag offset of the top card (drives the background glow) */
  onDrag?: (x: number) => void;
  /** after an undo, fly back in from the side it left */
  enterFrom?: SwipeDecision;
}

const DISTANCE = 110; // px past which a release commits
const SPEED = 650; // px/s fling that commits even when short

function buzz(d: SwipeDecision) {
  try {
    navigator.vibrate?.(d === "love" ? [10, 40, 14] : d === "nope" ? 14 : 6);
  } catch {
    /* iOS Safari has no vibration API */
  }
}

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { movie, depth, onDecide, onDrag, enterFrom },
  ref,
) {
  const speed = useMotionSpeed();
  const top = depth === 0;
  const startX = enterFrom === "love" ? 520 : enterFrom === "nope" ? -520 : 0;
  const x = useMotionValue(startX);
  const y = useMotionValue(enterFrom === "skip" ? -700 : 0);
  const rotate = useTransform(x, [-320, 0, 320], [-18, 0, 18]);
  const loveOpacity = useTransform(x, [24, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -24], [1, 0]);
  const loveScale = useTransform(x, [24, 160], [0.8, 1.08]);
  const nopeScale = useTransform(x, [-160, -24], [1.08, 0.8]);
  const leaving = useRef(false);
  const [flying, setFlying] = useState(false); // a departing card stays above the new top card

  const spring = speed({ type: "spring", stiffness: 420, damping: 32 });

  useEffect(() => {
    if (!enterFrom) return;
    animate(x, 0, spring);
    animate(y, 0, spring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMotionValueEvent(x, "change", (v) => {
    if (top) onDrag?.(v);
  });

  const fly = (d: SwipeDecision, velocity = 0) => {
    if (leaving.current) return;
    leaving.current = true;
    setFlying(true);
    buzz(d);
    const w = window.innerWidth;
    const exit = speed({ type: "spring", stiffness: 240, damping: 30, velocity });
    const done =
      d === "skip"
        ? animate(y, -window.innerHeight - 200, exit)
        : animate(x, (d === "love" ? 1 : -1) * (w + 420), exit);
    if (d === "skip") animate(x, 0, exit);
    // hand over to the next card slightly before this one is fully gone: feels snappier
    let handed = false;
    const handOver = () => {
      if (handed) return;
      handed = true;
      onDecide(d);
    };
    setTimeout(handOver, d === "skip" ? 170 : 150);
    done.then(handOver);
  };

  useImperativeHandle(ref, () => ({ swipe: (d) => fly(d) }));

  const genres = movie.genre_ids
    .slice(0, 3)
    .map((g) => GENRES[g])
    .filter(Boolean);
  const lang = movie.original_language ? languageLabel(movie.original_language) : "";

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: flying ? 20 : 10 - depth }}
      initial={enterFrom ? false : { scale: 0.85, y: 40, opacity: 0 }}
      // cards stay opaque (no see-through ghosting mid-transition); depth is shown by dimming instead
      animate={{ scale: 1 - depth * 0.055, y: depth * 18, opacity: depth > 2 ? 0 : 1 }}
      // stay mounted while flying off (the next card is promoted ~150 ms in)
      exit={{ opacity: 0, transition: speed({ duration: 0.28, delay: 0.14 }) }}
      transition={speed({ type: "spring", stiffness: 380, damping: 30 })}
    >
      <motion.div
        role={top ? "group" : undefined}
        aria-label={top ? `${movie.title}. Swipe right to love, left to pass, up if you haven't seen it.` : undefined}
        aria-hidden={!top}
        className={`relative size-full touch-none select-none overflow-hidden rounded-[30px] bg-card shadow-[0_30px_60px_-20px_rgb(0_0_0_/_0.6)] ring-1 ring-tint/10 ${
          top ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        style={{ x, y, rotate, willChange: top ? "transform" : undefined }}
        drag={top}
        dragMomentum={false}
        dragElastic={0.9}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info;
          if (offset.x > DISTANCE || velocity.x > SPEED) fly("love", velocity.x);
          else if (offset.x < -DISTANCE || velocity.x < -SPEED) fly("nope", velocity.x);
          else if (offset.y < -140 || velocity.y < -900) fly("skip", velocity.y);
          else {
            animate(x, 0, spring);
            animate(y, 0, spring);
          }
        }}
      >
        <img
          src={tmdbImage(movie.poster_path, "w500")}
          alt=""
          draggable={false}
          className="pointer-events-none size-full object-cover"
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-black"
          initial={false}
          animate={{ opacity: Math.min(depth * 0.32, 0.7) }}
          transition={speed({ type: "spring", stiffness: 380, damping: 30 })}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
          style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.92), rgb(0 0 0 / 0.55) 45%, transparent)" }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="font-display text-[28px] font-extrabold leading-[1.05] tracking-tight drop-shadow">{movie.title}</p>
          <p className="mt-1.5 text-sm text-white/75">
            {[yearOf(movie.release_date), lang, `★ ${movie.vote_average.toFixed(1)}`].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <span key={g} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* stamps */}
        <motion.div
          aria-hidden
          style={{ opacity: loveOpacity, scale: loveScale }}
          className="pointer-events-none absolute left-5 top-6 flex -rotate-12 items-center gap-1.5 rounded-2xl border-4 border-match px-3 py-1 font-display text-3xl font-extrabold tracking-wide text-match shadow-[0_0_30px_-4px_var(--color-match)]"
        >
          <Heart className="size-6 fill-current" /> LOVE
        </motion.div>
        <motion.div
          aria-hidden
          style={{ opacity: nopeOpacity, scale: nopeScale }}
          className="pointer-events-none absolute right-5 top-6 flex rotate-12 items-center gap-1.5 rounded-2xl border-4 border-edge px-3 py-1 font-display text-3xl font-extrabold tracking-wide text-edge shadow-[0_0_30px_-4px_var(--color-edge)]"
        >
          NOPE <X className="size-6" strokeWidth={3.5} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
});
