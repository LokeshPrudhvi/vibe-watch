import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MOODS, type MoodId } from "@shared/moods";
import type { MarkType, MovieLite, SignalType } from "@shared/recommend";
import {
  DEFAULT_TASTE,
  TASTE_VERSION,
  addMark,
  addSignal,
  clampMinutes,
  hasMark,
  migrateTaste,
  removeMark,
  type PersistedTaste,
} from "@shared/taste";
import { persistStorage } from "@/lib/storage";

/** Mood, time budget and the taste log. Same rules as the web app (shared/taste.ts), saved in MMKV. */
interface VibeState extends PersistedTaste {
  setMood: (mood: MoodId) => void;
  setMinutes: (minutes: number) => void;
  mark: (type: MarkType, movie: MovieLite) => void;
  unmark: (type: MarkType, id: number) => void;
  signal: (type: SignalType, movie?: MovieLite) => void;
  resetTaste: () => void;
}

export const useVibeStore = create<VibeState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_TASTE,
      setMood: (mood) => {
        if (mood === get().mood) return;
        set({ mood });
        get().signal("mood", { id: 0, title: "", poster: null, genres: MOODS[mood].genres });
      },
      setMinutes: (minutes) => set({ minutes: clampMinutes(minutes) }),
      mark: (type, movie) => set((s) => ({ marks: addMark(s.marks, type, movie) })),
      unmark: (type, id) => set((s) => ({ marks: removeMark(s.marks, type, id) })),
      signal: (type, movie) => set((s) => ({ signals: addSignal(s.signals, type, movie) })),
      resetTaste: () => set({ marks: [], signals: [] }),
    }),
    {
      name: "vibe-store",
      version: TASTE_VERSION,
      storage: persistStorage,
      partialize: ({ mood, minutes, marks, signals }) => ({ mood, minutes, marks, signals }),
      migrate: (persisted, version) => migrateTaste(persisted, version) as VibeState,
    },
  ),
);

/** Is this title marked with `type`? */
export const useMarked = (type: MarkType, id?: number) => useVibeStore((s) => hasMark(s.marks, type, id));
