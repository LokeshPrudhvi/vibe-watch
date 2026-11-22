import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { Moon } from "lucide-react";
import { useNow } from "@/hooks/useUtils";
import { addMinutes, formatClock, formatDuration, minutesUntil } from "@/lib/time";
import { TIME_MAX, TIME_MIN, useVibeStore } from "@/store/useVibeStore";

/**
 * "I've got 2h 10m". While a finger is on the slider only this card updates (a local draft);
 * the store, and with it the whole Tonight page and its TMDB queries, hears about the new
 * value when you let go, or after a 300 ms pause mid-drag. Committing on every 5-minute step
 * re-rendered the page and rewrote localStorage dozens of times a second, which phones hate.
 */
export function TimeSlider() {
  const stored = useVibeStore((s) => s.minutes);
  const setMinutes = useVibeStore((s) => s.setMinutes);
  const now = useNow();
  const [draft, setDraft] = useState<number | null>(null);
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);
  const minutes = draft ?? stored;

  useEffect(() => () => clearTimeout(pause.current), []);

  const onInput = (value: number) => {
    if (value === minutes) return;
    try {
      navigator.vibrate?.(4); // tiny tick per step on Android
    } catch {
      /* no vibration API */
    }
    setDraft(value);
    clearTimeout(pause.current);
    pause.current = setTimeout(() => setMinutes(value), 300);
  };

  const commit = (e: SyntheticEvent<HTMLInputElement>) => {
    clearTimeout(pause.current);
    if (draft === null) return;
    setMinutes(Number(e.currentTarget.value));
    setDraft(null);
  };

  const pct = ((minutes - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100;
  const presets = [
    { label: "Before 11 PM", value: minutesUntil(23, now) },
    { label: "Before midnight", value: minutesUntil(0, now) },
  ].filter((p) => p.value >= TIME_MIN && p.value <= TIME_MAX);

  return (
    <section aria-label="Time-fit" className="rounded-[28px] bg-card px-4 pb-4 pt-4 ring-1 ring-tint/5 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Time-fit</p>
          <h2 className="mt-1 font-display text-[22px] font-bold sm:text-2xl">
            I've got <span className="text-time tabular-nums">{formatDuration(minutes)}</span>
          </h2>
        </div>
        <div className="rounded-2xl bg-tint/5 px-3 py-2 text-right">
          <p className="flex items-center justify-end gap-1 text-[11px] text-muted">
            <Moon className="size-3" /> Done by
          </p>
          <p className="font-semibold tabular-nums">{formatClock(addMinutes(now, minutes))}</p>
        </div>
      </div>

      <input
        type="range"
        min={TIME_MIN}
        max={TIME_MAX}
        step={5}
        value={minutes}
        onChange={(e) => onInput(Number(e.target.value))}
        onPointerUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label="Time available"
        aria-valuetext={formatDuration(minutes)}
        className="vibe-range mt-2 w-full sm:mt-4"
        style={{ "--pct": `${pct}%` } as CSSProperties}
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>1h</span>
        <span>4h</span>
      </div>

      {presets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => setMinutes(Math.floor(p.value / 5) * 5)}
              className="rounded-full bg-tint/6 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-tint/12"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <p className="mt-4 hidden text-xs text-muted sm:block">Only showing films that finish in time.</p>
    </section>
  );
}
