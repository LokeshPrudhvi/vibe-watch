import { motion } from "motion/react";
import { useMotionSpeed } from "@/lib/motion";

/** Circular taste-match meter. */
export function MatchRing({ value, size = 56 }: { value: number; size?: number }) {
  const speed = useMotionSpeed();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} title="Taste match">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab, var(--color-tint) 10%, transparent)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-match)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={speed({ duration: 0.9, ease: [0.22, 1, 0.36, 1] })}
        />
      </svg>
      <div className="absolute text-center leading-none">
        <span className="text-sm font-bold tabular-nums">{value}</span>
        <span className="text-[9px] text-muted">%</span>
      </div>
    </div>
  );
}
