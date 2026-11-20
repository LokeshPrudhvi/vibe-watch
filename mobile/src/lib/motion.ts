import { LinearTransition, type WithSpringConfig } from "react-native-reanimated";
import { MOTION_SCALE, useSettings } from "@/store/settings";

export interface Spring {
  stiffness: number;
  damping: number;
  mass?: number;
}

/**
 * Applies Settings → Animation speed to Reanimated animations, like the web's Motion scaling.
 * Springs are time-scaled exactly (stiffness / k², damping / k). "Off" returns undefined,
 * which callers treat as "jump straight to the end".
 * Reanimated already honours the system reduce-motion setting by default.
 */
export function useMotion() {
  const k = MOTION_SCALE[useSettings((s) => s.motion)];
  return {
    off: k === 0,
    spring: (s: Spring): WithSpringConfig | undefined =>
      k === 0 ? undefined : { mass: s.mass ?? 1, stiffness: s.stiffness / (k * k), damping: s.damping / k },
    duration: (ms: number) => Math.round(ms * k),
    /** Layout transition for views that change size or position. */
    layout: (s: Spring) =>
      k === 0 ? undefined : LinearTransition.springify().stiffness(s.stiffness / (k * k)).damping(s.damping / k),
  };
}

export const SPRING = {
  nav: { stiffness: 420, damping: 36 },
  pill: { stiffness: 500, damping: 38 },
  chip: { stiffness: 450, damping: 34 },
  toggle: { stiffness: 600, damping: 36 },
  press: { stiffness: 700, damping: 30 },
} satisfies Record<string, Spring>;
