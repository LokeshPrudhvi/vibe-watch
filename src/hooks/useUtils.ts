import { useEffect, useState } from "react";

/** Current time, refreshed every 30s so "ends at" labels stay honest. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * Height of the on-screen keyboard overlapping the layout viewport (iOS Safari/WKWebView).
 * Android Chrome resizes the page instead (interactive-widget=resizes-content), so it reads 0 there.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => {
      const overlap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      setInset(overlap > 80 ? overlap : 0);
    };
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, []);
  return inset;
}

const DEFAULT_TITLE = "vibe. — what are we watching?";

/** Sets the tab title for the current page; falls back to the app title. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · vibe.` : DEFAULT_TITLE;
  }, [title]);
}

export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return scrolled;
}
