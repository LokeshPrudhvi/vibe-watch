import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";
export type MotionSpeed = "off" | "slow" | "normal" | "fast";

export interface Settings {
  theme: ThemeMode;
  /** Translucent surfaces with a light-catching rim (off = classic frosted glass). */
  liquidGlass: boolean;
  /** SVG displacement refraction on the floating navbar. Chromium/Android only. */
  refraction: boolean;
  /** Layered blur that fades in under the header and navbar. */
  progressiveBlur: boolean;
  /** Lighter backdrop blur on floating bars. */
  reduceBlur: boolean;
  /** Cheap glass for older devices: low blur, no saturation, no refraction or progressive blur. */
  glassPerformance: boolean;
  motion: MotionSpeed;
}

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  liquidGlass: true,
  refraction: false,
  progressiveBlur: true,
  reduceBlur: false,
  glassPerformance: false,
  motion: "normal",
};

/** Duration multiplier per speed (bigger = slower). */
export const MOTION_SCALE: Record<MotionSpeed, number> = { off: 0, slow: 1.6, normal: 1, fast: 0.6 };

export const SETTINGS_STORAGE_KEY = "vibe-settings";

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: SETTINGS_STORAGE_KEY, version: 1 },
  ),
);

/** Effective values after device support and the performance switch are applied. */
export function useEffectiveGlass() {
  const s = useSettings();
  const perf = s.glassPerformance;
  const refraction = s.refraction && s.liquidGlass && !perf && supportsRefraction();
  return {
    liquid: s.liquidGlass,
    refraction,
    // the blur sits right under the navbar, so with refraction on the glass would only bend blur
    progressive: s.progressiveBlur && !perf && !refraction,
    reduced: s.reduceBlur,
    perf,
  };
}

let refractionSupport: boolean | undefined;
/**
 * Real refraction needs SVG filters inside backdrop-filter, which only Chromium
 * implements (Chrome, Edge, Samsung Internet, Android WebView). Safari/iOS and Firefox can't.
 */
export function supportsRefraction() {
  if (refractionSupport !== undefined) return refractionSupport;
  if (typeof window === "undefined" || typeof CSS === "undefined") return false;
  const ua = navigator.userAgent;
  const chromium = /Chrome\/\d+/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  refractionSupport = chromium && CSS.supports("backdrop-filter", "url(#a)");
  return refractionSupport;
}
