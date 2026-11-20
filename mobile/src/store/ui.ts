import { create } from "zustand";

/* ---------- Toast (one at a time, optional Undo) ---------- */

interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

interface ToastState {
  toast: Toast | null;
  show: (text: string, undo?: () => void) => void;
  dismiss: () => void;
}

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>()((set) => ({
  toast: null,
  show: (text, undo) => {
    clearTimeout(timer);
    const id = ++seq;
    set({ toast: { id, text, undo } });
    timer = setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 5000);
  },
  dismiss: () => set({ toast: null }),
}));

/* ---------- Search (typed in the navbar, shown on the Search tab) ---------- */

interface SearchState {
  query: string;
  /** ISO 639-1 original language filter */
  lang?: string;
  setQuery: (query: string) => void;
  setLang: (lang?: string) => void;
}

export const useSearch = create<SearchState>()((set) => ({
  query: "",
  lang: undefined,
  setQuery: (query) => set({ query }),
  setLang: (lang) => set({ lang }),
}));
