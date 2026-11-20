import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  /** "pending" until the first-run swipe deck is finished or skipped. */
  status: "pending" | "done";
  finish: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      status: "pending",
      finish: () => set({ status: "done" }),
    }),
    { name: "vibe-onboarding", version: 1 },
  ),
);
