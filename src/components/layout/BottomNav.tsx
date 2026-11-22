import { useEffect, useRef, type CSSProperties } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { Compass, LibraryBig, MoonStar, Search, UsersRound, X, type LucideIcon } from "lucide-react";
import { useRefraction } from "@/hooks/useRefraction";
import { useKeyboardInset } from "@/hooks/useUtils";
import { useMotionSpeed } from "@/lib/motion";
import { useEffectiveGlass } from "@/store/useSettings";

export const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Tonight", icon: MoonStar, end: true },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/together", label: "Together", icon: UsersRound },
  { to: "/library", label: "Library", icon: LibraryBig },
];

const BAR = 64; // px — big, thumb-friendly targets
const SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;

/**
 * Full-width floating navbar in two parts: a tab group (icon above label) and a separate
 * search button. On /search the two swap roles: tabs collapse into a close button and the
 * search button grows into a search field, so typing happens right by your thumb.
 */
export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const searching = location.pathname === "/search";
  const lastTab = useRef("/");
  const glass = useEffectiveGlass();
  const speed = useMotionSpeed();
  const left = useRefraction<HTMLElement>(glass.refraction);
  const right = useRefraction<HTMLElement>(glass.refraction);
  const keyboard = useKeyboardInset();
  const query = params.get("q") ?? "";
  // only touch ?q — keep other filters like ?lang= intact
  const setQuery = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if (!searching) lastTab.current = location.pathname;
  }, [searching, location.pathname]);

  const shell = (extra?: CSSProperties): CSSProperties => ({ borderRadius: BAR / 2, ...extra });
  const transition = speed(SPRING);

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 z-40 px-3 sm:px-4"
      style={{
        bottom: keyboard,
        paddingBottom: keyboard ? 8 : "max(env(safe-area-inset-bottom), 12px)",
      }}
    >
      {left.filter}
      {right.filter}
      <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2.5">
        {searching ? (
          <>
            <motion.button
              key="close"
              layoutId="nav-left"
              transition={transition}
              ref={left.ref}
              onClick={() => navigate(lastTab.current)}
              aria-label="Close search"
              className="glass glass-float grid shrink-0 place-items-center text-ink"
              style={shell({ width: BAR, height: BAR, ...left.style })}
            >
              <X className="size-[26px]" />
            </motion.button>
            <motion.div
              key="field"
              layoutId="nav-right"
              transition={transition}
              ref={right.ref}
              className="glass glass-float flex min-w-0 flex-1 items-center gap-3 pl-5 pr-2"
              style={shell({ height: BAR, ...right.style })}
            >
              <Search className="size-[22px] shrink-0 text-muted" />
              <input
                autoFocus
                type="search"
                enterKeyHint="search"
                aria-label="Search movies"
                placeholder="Search movies"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-tint/10 text-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              )}
            </motion.div>
          </>
        ) : (
          <>
            <motion.div
              key="tabs"
              layoutId="nav-left"
              transition={transition}
              ref={left.ref}
              className="glass glass-float flex min-w-0 flex-1 items-stretch p-1.5"
              style={shell({ height: BAR, ...left.style })}
            >
              {TABS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full text-muted transition-colors hover:text-ink aria-[current=page]:text-ink"
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="glass-pill absolute inset-0 rounded-full"
                          transition={speed({ type: "spring", stiffness: 500, damping: 38 })}
                        />
                      )}
                      <Icon className="relative size-[26px]" strokeWidth={isActive ? 2.3 : 1.9} />
                      <span className="relative truncate text-[11px] font-semibold leading-none">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </motion.div>
            <motion.button
              key="search"
              layoutId="nav-right"
              transition={transition}
              ref={right.ref}
              onClick={() => navigate("/search")}
              aria-label="Search"
              className="glass glass-float grid shrink-0 place-items-center text-ink"
              style={shell({ width: BAR, height: BAR, ...right.style })}
            >
              <Search className="size-[26px]" strokeWidth={2.1} />
            </motion.button>
          </>
        )}
      </div>
    </nav>
  );
}
