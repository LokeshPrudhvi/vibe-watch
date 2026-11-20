import { useMemo } from "react";
import { motion } from "motion/react";
import { Heart } from "lucide-react";
import { useMotionSpeed } from "@/lib/motion";

/** Little reward: hearts float up and out from the deck on every Love. */
export function HeartBurst({ seed }: { seed: number }) {
  const speed = useMotionSpeed();
  const hearts = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const angle = -Math.PI / 2 + ((i - 4) / 4) * 1.1 + (((seed * 13 + i * 7) % 10) / 10 - 0.5) * 0.4;
        const dist = 110 + ((seed * 31 + i * 17) % 70);
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 16 + ((seed + i * 5) % 14), rot: ((i * 37) % 60) - 30 };
      }),
    [seed],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-30">
      {hearts.map((h, i) => (
        <motion.span
          key={i}
          className="absolute text-match"
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
          animate={{ x: h.x, y: h.y, scale: 1, opacity: 0, rotate: h.rot }}
          transition={speed({ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: i * 0.015 })}
          style={{ marginLeft: -h.size / 2, marginTop: -h.size / 2 }}
        >
          <Heart style={{ width: h.size, height: h.size }} className="fill-current drop-shadow-[0_0_10px_var(--color-match)]" />
        </motion.span>
      ))}
    </div>
  );
}

const CONFETTI_COLORS = ["var(--color-cozy)", "var(--color-mind)", "var(--color-feel)", "var(--color-edge)", "var(--color-match)", "#ffffff"];

/** Celebration burst for finishing the deck. Pure transforms, ~60 particles, no canvas. */
export function Confetti() {
  const speed = useMotionSpeed();
  const bits = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => {
        const angle = (i / 64) * Math.PI * 2 + (i % 3) * 0.2;
        const power = 180 + ((i * 53) % 240);
        return {
          x: Math.cos(angle) * power,
          y: Math.sin(angle) * power * 0.8 - 120,
          fall: 260 + ((i * 29) % 220),
          rot: ((i * 97) % 720) - 360,
          w: 6 + (i % 4) * 2,
          h: 10 + (i % 3) * 4,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: i % 5 === 0,
          delay: (i % 8) * 0.012,
        };
      }),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed left-1/2 top-[38%] z-50">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{ width: b.w, height: b.round ? b.w : b.h, background: b.color, borderRadius: b.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: [0, b.x, b.x * 1.1], y: [0, b.y, b.y + b.fall], rotate: b.rot, opacity: [1, 1, 0], scale: 1 }}
          transition={speed({ duration: 1.8, times: [0, 0.35, 1], ease: "easeOut", delay: b.delay })}
        />
      ))}
    </div>
  );
}
