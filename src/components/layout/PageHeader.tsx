import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Settings } from "lucide-react";
import { useScrolled } from "@/hooks/useUtils";

/**
 * Large-title header (iOS pattern). The big title scrolls away with the page; a thin sticky
 * bar keeps the actions and fades in a small title once the big one has passed under it.
 *
 * Nothing here changes size on scroll. (The old version shrank the title, which made the
 * page shorter, which moved the scroll position back under the threshold, which grew the
 * title again: a visible "beating" loop just past the top of the page.)
 */
export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: ReactNode; action?: ReactNode }) {
  const onSettings = useLocation().pathname === "/settings";
  const bar = useRef<HTMLDivElement>(null);
  const bigTitle = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const scrolled = useScrolled(4); // only swaps the bar's background, never its size

  useEffect(() => {
    const el = bigTitle.current;
    const barHeight = bar.current?.offsetHeight ?? 60; // includes the notch / status-bar inset
    if (!el) return;
    // collapsed once the big title has slid completely under the bar
    const io = new IntersectionObserver(
      ([e]) => setCollapsed(!e.isIntersecting && e.boundingClientRect.top < barHeight),
      { rootMargin: `-${barHeight}px 0px 0px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const solid = scrolled;

  return (
    <>
      <div
        ref={bar}
        className={`sticky top-0 z-30 transition-[background-color,border-color] duration-(--dur-slow) ${
          solid ? "glass rounded-none !border-x-0 !border-t-0" : "border-b border-transparent"
        }`}
        style={solid ? { boxShadow: "none" } : undefined}
      >
        <div className="flex h-[calc(env(safe-area-inset-top)+60px)] items-end justify-between gap-3 px-4 pb-2 pt-[env(safe-area-inset-top)] md:px-8">
          <p
            aria-hidden={!collapsed}
            className={`min-w-0 truncate pb-2 font-display text-lg font-extrabold tracking-tight transition-opacity duration-(--dur-slow) ${
              collapsed ? "opacity-100" : "opacity-0"
            }`}
          >
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {!onSettings && (
              <Link
                to="/settings"
                aria-label="Settings"
                title="Settings"
                className="grid size-11 place-items-center rounded-full bg-tint/8 text-ink transition hover:bg-tint/15"
              >
                <Settings className="size-5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* big title: normal flow, tucked up beside the actions so the top looks unchanged */}
      <header className="-mt-12 px-4 pb-3 pr-20 md:px-8">
        {eyebrow ? <p className="h-4 text-xs font-medium capitalize text-muted">{eyebrow}</p> : <div className="h-4" />}
        <h1 ref={bigTitle} className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          {title}
        </h1>
      </header>
    </>
  );
}
