import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SyncOp } from "@/lib/syncOps";

export type ConsentChoice = "unknown" | "yes" | "no";

interface AccountState {
  /** The answer to "share your activity?". Asked once, on first launch. */
  consent: ConsentChoice;
  /** Upload queue; survives reloads and offline periods. */
  outbox: SyncOp[];
  /** Accounts whose Library has already been merged and backfilled on this device. */
  backfilled: string[];
  /** UI: account sheet open (not persisted). */
  accountOpen: boolean;
  setConsent: (c: ConsentChoice) => void;
  enqueue: (ops: SyncOp[]) => void;
  dequeue: (count: number) => void;
  markBackfilled: (userId: string) => void;
  openAccount: () => void;
  closeAccount: () => void;
}

const MAX_OUTBOX = 2000;

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      consent: "unknown",
      outbox: [],
      backfilled: [],
      accountOpen: false,
      setConsent: (consent) => set(consent === "no" ? { consent, outbox: [] } : { consent }),
      enqueue: (ops) => set((s) => ({ outbox: [...s.outbox, ...ops].slice(-MAX_OUTBOX) })),
      dequeue: (count) => set((s) => ({ outbox: s.outbox.slice(count) })),
      markBackfilled: (userId) => set((s) => ({ backfilled: [...new Set([...s.backfilled, userId])] })),
      openAccount: () => set({ accountOpen: true }),
      closeAccount: () => set({ accountOpen: false }),
    }),
    {
      name: "vibe-account",
      version: 1,
      partialize: ({ consent, outbox, backfilled }) => ({ consent, outbox, backfilled }),
    },
  ),
);
