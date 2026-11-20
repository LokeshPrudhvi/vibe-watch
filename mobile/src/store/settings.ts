import * as Device from "expo-device";
import { Platform } from "react-native";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "@/lib/storage";

export type ThemeMode = "dark" | "light" | "system";
export type MotionSpeed = "off" | "slow" | "normal" | "fast";

export interface Settings {
  theme: ThemeMode;
  /** Clear, light-catching glass (off = classic frosted glass). */
  liquidGlass: boolean;
  /** Lighter blur behind floating bars. */
  reduceBlur: boolean;
  /** Cheap glass for older phones: no live blur, mostly opaque bars. */
  glassPerformance: boolean;
  motion: MotionSpeed;
}

/** Android before 12 has no cheap native blur; under 4 GB of RAM, live blur costs too much. */
export function isLowEndDevice() {
  const lowMemory = (Device.totalMemory ?? Infinity) < 4 * 1024 ** 3;
  const oldAndroid = Platform.OS === "android" && Number(Platform.Version) < 31;
  return lowMemory || oldAndroid;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  liquidGlass: true,
  reduceBlur: false,
  glassPerformance: isLowEndDevice(),
  motion: "normal",
};

/** Duration multiplier per speed (bigger = slower). */
export const MOTION_SCALE: Record<MotionSpeed, number> = { off: 0, slow: 1.6, normal: 1, fast: 0.6 };

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: "vibe-settings", version: 1, storage: persistStorage },
  ),
);

/** Glass settings after the performance switch is applied. */
export function useEffectiveGlass() {
  const liquid = useSettings((s) => s.liquidGlass);
  const reduced = useSettings((s) => s.reduceBlur);
  const perf = useSettings((s) => s.glassPerformance);
  return { liquid, reduced, perf, blur: !perf };
}
