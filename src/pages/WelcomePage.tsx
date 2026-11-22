import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { Heart, HelpCircle, RotateCcw, Sparkles, X } from "lucide-react";
import { SwipeCard, type SwipeCardHandle } from "@/components/onboarding/SwipeCard";
import { Confetti, HeartBurst } from "@/components/onboarding/Bursts";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOnboardingDeck } from "@/hooks/useOnboardingDeck";
import { usePosterAccent } from "@/hooks/usePosterAccent";
import { useDocumentTitle } from "@/hooks/useUtils";
import { GENRES } from "@/lib/moods";
import { languageLabel } from "@/lib/languages";
import { useMotionSpeed } from "@/lib/motion";
import { tmdbImage, type MovieSummary } from "@/lib/tmdb";
import { useEffectiveGlass } from "@/store/useSettings";
import { useOnboarding } from "@/store/useOnboarding";
import { toLite, useVibeStore } from "@/store/useVibeStore";
import { MIN_SWIPES, type SwipeDecision } from "../../shared/onboarding";

interface Step {
  movie: MovieSummary;
  d: SwipeDecision;
}

/** What the loves so far say about you: top genres and languages, with counts. */
function vibeChips(history: Step[]) {
  const counts = new Map<string, number>();
  for (const { movie, d } of history) {
    if (d !== "love") continue;
    for (const g of movie.genre_ids.slice(0, 2)) {
      const name = GENRES[g];
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (movie.original_language) {
      const l = languageLabel(movie.original_language);
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export default function WelcomePage() {
  useDocumentTitle("Tune your taste");
  const navigate = useNavigate();
  const speed = useMotionSpeed();
  const glass = useEffectiveGlass();
  const { deck, loading, failed, retry } = useOnboardingDeck();
  const mark = useVibeStore((s) => s.mark);
  const unmark = useVibeStore((s) => s.unmark);
  const finish = useOnboarding((s) => s.finish);

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Step[]>([]);
  const [enterFrom, setEnterFrom] = useState<{ id: number; d: SwipeDecision } | null>(null);
  const [burst, setBurst] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  // one handle per card (by film id): a departing card unmounting must not clear the new top card's
  const handles = useRef(new Map<number, SwipeCardHandle>());

  // live drag offset of the top card: drives glows + button growth without re-rendering
  const dragX = useMotionValue(0);
  const loveGlow = useTransform(dragX, [0, 180], [0, 1]);
  const nopeGlow = useTransform(dragX, [-180, 0], [1, 0]);
  const loveBtn = useTransform(dragX, [0, 150], [1, 1.18]);
  const nopeBtn = useTransform(dragX, [-150, 0], [1.18, 1]);

  const current = deck[index];
  const swipeTop = (d: SwipeDecision) => (current ? handles.current.get(current.id)?.swipe(d) : undefined);
  const accent = usePosterAccent(current?.poster_path);
  const loves = history.filter((h) => h.d === "love").length;
  const nopes = history.filter((h) => h.d === "nope").length;
  const canFinish = history.length >= MIN_SWIPES;
  const chips = useMemo(() => vibeChips(history), [history]);
  const visible = deck.slice(index, index + 3);

  const decide = (d: SwipeDecision) => {
    const movie = deck[index];
    if (!movie) return;
    if (d === "love") {
      mark("like", toLite(movie));
      setBurst((b) => b + 1);
    } else if (d === "nope") {
      mark("dislike", toLite(movie));
    }
    setHistory((h) => [...h, { movie, d }]);
    setEnterFrom(null);
    dragX.set(0);
    setIndex((i) => i + 1);
    if (index + 1 >= deck.length) setTimeout(() => setCelebrating(true), 220);
  };

  const undo = () => {
    const last = history.at(-1);
    if (!last) return;
    if (last.d === "love") unmark("like", last.movie.id);
    if (last.d === "nope") unmark("dislike", last.movie.id);
    setHistory((h) => h.slice(0, -1));
    setEnterFrom({ id: last.movie.id, d: last.d });
    setIndex((i) => Math.max(0, i - 1));
    setCelebrating(false);
  };

  const leave = () => {
    finish();
    navigate("/", { replace: true });
  };

  // desktop: ← nope · → love · ↑ haven't seen · backspace undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (celebrating) return;
      if (e.key === "ArrowRight") swipeTop("love");
      else if (e.key === "ArrowLeft") swipeTop("nope");
      else if (e.key === "ArrowUp") swipeTop("skip");
      else if (e.key === "Backspace" || e.key.toLowerCase() === "z") undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="accent-scope relative isolate flex min-h-dvh flex-col overflow-hidden bg-base text-ink"
      style={{ "--accent": accent } as CSSProperties}
    >
      {/* ---------- living background ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <AnimatePresence>
          {current && !glass.perf && (
            <motion.img
              key={current.id}
              src={tmdbImage(current.poster_path, "w185")}
              alt=""
              className="absolute inset-0 size-full scale-125 object-cover blur-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.32 }}
              exit={{ opacity: 0 }}
              transition={speed({ duration: 0.6 })}
            />
          )}
        </AnimatePresence>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 50% at 50% 42%, color-mix(in oklab, var(--accent) 35%, transparent), transparent 70%), linear-gradient(to bottom, color-mix(in oklab, var(--color-base) 30%, transparent), var(--color-base) 92%)",
          }}
        />
        <motion.div
          className="absolute inset-0"
          style={{ opacity: loveGlow, background: "radial-gradient(60% 50% at 85% 45%, color-mix(in oklab, var(--color-match) 40%, transparent), transparent 70%)" }}
        />
        <motion.div
          className="absolute inset-0"
          style={{ opacity: nopeGlow, background: "radial-gradient(60% 50% at 15% 45%, color-mix(in oklab, var(--color-edge) 40%, transparent), transparent 70%)" }}
        />
      </div>

      {/* ---------- header ---------- */}
      <header className="px-5 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex h-1.5 gap-1" aria-label={`${history.length} of ${deck.length || 15} rated`}>
          {(deck.length ? deck : Array.from({ length: 15 })).map((_, i) => {
            const step = history[i];
            const color = !step
              ? undefined
              : step.d === "love"
                ? "var(--color-match)"
                : step.d === "nope"
                  ? "var(--color-edge)"
                  : "color-mix(in oklab, var(--color-tint) 35%, transparent)";
            return (
              <div key={i} className="relative flex-1 overflow-hidden rounded-full bg-tint/12">
                <motion.div
                  className="absolute inset-0 origin-left rounded-full"
                  style={{ background: color ?? "var(--color-ink)" }}
                  initial={false}
                  animate={{ scaleX: step ? 1 : i === index ? 0.25 : 0, opacity: step ? 1 : i === index ? 0.6 : 0 }}
                  transition={speed({ type: "spring", stiffness: 400, damping: 30 })}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">Tune your taste</h1>
            <p className="mt-1 text-sm text-muted">Right if you'd watch it, left if you wouldn't, up if you don't know it.</p>
          </div>
          <button
            onClick={canFinish ? () => setCelebrating(true) : leave}
            className={`h-10 w-20 shrink-0 rounded-full text-sm font-bold transition-colors ${
              canFinish ? "accent-btn" : "text-muted hover:text-ink"
            }`}
          >
            {canFinish ? "Done" : "Skip"}
          </button>
        </div>
      </header>

      {/* ---------- deck ---------- */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-4">
        <div className="relative aspect-[2/3] h-[min(56dvh,520px)] max-w-full">
          {loading && (
            <>
              <Skeleton className="absolute inset-0 rounded-[30px]" />
              <p className="absolute inset-x-0 -bottom-8 text-center text-xs text-muted">Picking films you'll recognise…</p>
            </>
          )}
          {failed && (
            <div className="absolute inset-0 grid place-items-center rounded-[30px] bg-card p-6 text-center ring-1 ring-tint/10">
              <div>
                <p className="font-display text-xl font-bold">Couldn't load the films</p>
                <p className="mt-2 text-sm text-muted">Check your connection, or skip this for now.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={retry} className="h-10 rounded-full bg-tint/10 px-4 text-sm font-semibold">
                    Try again
                  </button>
                  <button onClick={leave} className="h-10 rounded-full px-4 text-sm font-semibold text-muted">
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}
          <AnimatePresence>
            {visible.map((m, i) => (
              <SwipeCard
                key={m.id}
                ref={(h) => {
                  if (h) handles.current.set(m.id, h);
                  else handles.current.delete(m.id);
                }}
                movie={m}
                depth={i}
                onDecide={decide}
                onDrag={(v) => dragX.set(v)}
                enterFrom={enterFrom?.id === m.id ? enterFrom.d : undefined}
              />
            ))}
          </AnimatePresence>
          <AnimatePresence>{burst > 0 && <HeartBurst key={burst} seed={burst} />}</AnimatePresence>
        </div>
      </main>

      {/* ---------- actions ---------- */}
      <div className="flex items-center justify-center gap-4 px-5">
        <RoundButton label="Undo" size="sm" onClick={undo} disabled={!history.length}>
          <RotateCcw className="size-5" />
        </RoundButton>
        <RoundButton label="Not for me" size="lg" tone="nope" scale={nopeBtn} onClick={() => swipeTop("nope")} disabled={!current}>
          <X className="size-8" strokeWidth={3} />
        </RoundButton>
        <RoundButton label="Haven't seen it" size="sm" onClick={() => swipeTop("skip")} disabled={!current}>
          <HelpCircle className="size-5" />
        </RoundButton>
        <RoundButton label="Love it" size="lg" tone="love" scale={loveBtn} onClick={() => swipeTop("love")} disabled={!current}>
          <Heart className="size-8 fill-current" />
        </RoundButton>
      </div>

      {/* ---------- your vibe so far (fixed height: nothing below jumps) ---------- */}
      <footer className="px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-5">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          <span>Your vibe so far</span>
          <span className="flex gap-3 normal-case tracking-normal">
            <Counter value={loves} icon={<Heart className="size-3.5 fill-current text-match" />} />
            <Counter value={nopes} icon={<X className="size-3.5 text-edge" strokeWidth={3} />} />
          </span>
        </div>
        <div className="mt-2 flex h-9 flex-wrap gap-1.5 overflow-hidden">
          {chips.length === 0 ? (
            <p className="text-sm text-muted">Love a few and watch your taste appear here.</p>
          ) : (
            <AnimatePresence initial={false}>
              {chips.map(([name, n]) => (
                <motion.span
                  key={name}
                  layout
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={speed({ type: "spring", stiffness: 500, damping: 26 })}
                  className="accent-chip inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                >
                  {name}
                  <span className="opacity-70">×{n}</span>
                </motion.span>
              ))}
            </AnimatePresence>
          )}
        </div>
      </footer>

      {/* ---------- finish ---------- */}
      <AnimatePresence>
        {celebrating && (
          <Celebration
            loves={loves}
            nopes={nopes}
            chips={chips}
            moreLeft={index < deck.length}
            onGo={leave}
            onMore={() => setCelebrating(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RoundButton({
  label,
  size,
  tone,
  scale,
  onClick,
  disabled,
  children,
}: {
  label: string;
  size: "sm" | "lg";
  tone?: "love" | "nope";
  scale?: ReturnType<typeof useTransform<number, number>>;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const color = tone === "love" ? "var(--color-match)" : tone === "nope" ? "var(--color-edge)" : undefined;
  return (
    <motion.button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.86 }}
      style={{
        scale,
        color,
        boxShadow: color ? `0 12px 30px -10px ${color}, inset 0 0 0 2px color-mix(in oklab, ${color} 55%, transparent)` : undefined,
      }}
      className={`glass grid shrink-0 place-items-center rounded-full disabled:opacity-35 ${size === "lg" ? "size-[72px]" : "size-12 text-muted"}`}
    >
      {children}
    </motion.button>
  );
}

function Counter({ value, icon }: { value: number; icon: React.ReactNode }) {
  const speed = useMotionSpeed();
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-ink">
      {icon}
      <motion.span
        key={value}
        initial={{ scale: 1.8, y: -2 }}
        animate={{ scale: 1, y: 0 }}
        transition={speed({ type: "spring", stiffness: 600, damping: 18 })}
        className="inline-block tabular-nums"
      >
        {value}
      </motion.span>
    </span>
  );
}

function Celebration({
  loves,
  nopes,
  chips,
  moreLeft,
  onGo,
  onMore,
}: {
  loves: number;
  nopes: number;
  chips: [string, number][];
  moreLeft: boolean;
  onGo: () => void;
  onMore: () => void;
}) {
  const speed = useMotionSpeed();
  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-center bg-base/80 px-6 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Taste unlocked"
    >
      <Confetti />
      <div className="max-w-sm text-center">
        <motion.div
          className="accent-btn mx-auto grid size-20 place-items-center rounded-full"
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={speed({ type: "spring", stiffness: 300, damping: 14, delay: 0.1 })}
        >
          <Sparkles className="size-10" />
        </motion.div>
        <motion.h2
          className="mt-6 font-display text-4xl font-extrabold tracking-tight"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={speed({ delay: 0.25, type: "spring", stiffness: 260, damping: 22 })}
        >
          Taste unlocked
        </motion.h2>
        <motion.p
          className="mt-2 text-muted"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={speed({ delay: 0.35 })}
        >
          {loves} loved · {nopes} passed. Tonight's pick is now tuned to you.
        </motion.p>
        {chips.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {chips.map(([name], i) => (
              <motion.span
                key={name}
                className="accent-chip rounded-full px-3 py-1.5 text-xs font-bold"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={speed({ type: "spring", stiffness: 500, damping: 20, delay: 0.45 + i * 0.07 })}
              >
                {name}
              </motion.span>
            ))}
          </div>
        )}
        <motion.div
          className="mt-8 grid gap-2"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={speed({ delay: 0.6 })}
        >
          <motion.button whileTap={{ scale: 0.96 }} onClick={onGo} className="h-14 rounded-full bg-ink text-base font-bold text-inverse">
            See tonight's pick
          </motion.button>
          {moreLeft && (
            <button onClick={onMore} className="h-12 rounded-full text-sm font-semibold text-muted hover:text-ink">
              Keep swiping
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
