import type { Transition } from "motion/react";
import { MOTION_SCALE, useSettings } from "@/store/useSettings";

/**
 * Stretches or squeezes a transition by `k` (duration multiplier).
 * Springs are time-scaled exactly: stiffness / k², damping / k.
 */
export function scaleTransition(t: Transition, k: number): Transition {
  if (k === 1) return t;
  if (k === 0) return { duration: 0 };
  const out: Record<string, unknown> = { ...(t as Record<string, unknown>) };
  if (typeof out.stiffness === "number") out.stiffness = (out.stiffness as number) / (k * k);
  if (typeof out.damping === "number") out.damping = (out.damping as number) / k;
  if (typeof out.duration === "number") out.duration = (out.duration as number) * k;
  if (typeof out.delay === "number") out.delay = (out.delay as number) * k;
  return out as Transition;
}

/** Returns a function that applies the user's animation speed to a transition. */
export function useMotionSpeed() {
  const speed = useSettings((s) => s.motion);
  const k = MOTION_SCALE[speed];
  return (t: Transition) => scaleTransition(t, k);
}
