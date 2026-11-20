import type { CSSProperties } from "react";
import { Moon } from "lucide-react";
import { useNow } from "@/hooks/useUtils";
import { addMinutes, formatClock, formatDuration, minutesUntil } from "@/lib/time";
import { TIME_MAX, TIME_MIN, useVibeStore } from "@/store/useVibeStore";

export function TimeSlider() {
  const minutes = useVibeStore((s) => s.minutes);
  const setMinutes = useVibeStore((s) => s.setMinutes);
  const now = useNow();

  const pct = ((minutes - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100;
  const presets = [
    { label: "Before 11 PM", value: minutesUntil(23, now) },
    { label: "Before midnight", value: minutesUntil(0, now) },
  ].filter((p) => p.value >= TIME_MIN && p.value <= TIME_MAX);

  return (
    <section aria-label="Time-fit" className="rounded-[28px] bg-card p-5 ring-1 ring-tint/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Time-fit</p>
          <h2 className="mt-1 font-display text-2xl font-bold">
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
        onChange={(e) => setMinutes(Number(e.target.value))}
        aria-label="Time available"
        aria-valuetext={formatDuration(minutes)}
        className="vibe-range mt-6 w-full"
        style={{ "--pct": `${pct}%` } as CSSProperties}
      />
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>1h</span>
        <span>4h</span>
      </div>

      {presets.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
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
      <p className="mt-4 text-xs text-muted">Only showing films that finish in time.</p>
    </section>
  );
}
