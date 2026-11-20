import type { CSSProperties } from "react";

const LAYERS = 6;

/**
 * Stacked backdrop blurs, each masked to a band, so blur ramps up smoothly toward
 * the screen edge instead of stopping at a hard line. Strongest at `edge`.
 */
export function ProgressiveBlur({
  edge,
  height,
  maxBlur = 24,
}: {
  edge: "top" | "bottom";
  height: string;
  maxBlur?: number;
}) {
  const dir = edge === "top" ? "to top" : "to bottom"; // gradient runs toward the edge
  const step = 100 / LAYERS;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-20"
      style={{ [edge]: 0, height } as CSSProperties}
    >
      {Array.from({ length: LAYERS }, (_, i) => {
        const blur = maxBlur / 2 ** (LAYERS - 1 - i); // …, max/4, max/2, max
        const a = i * step;
        const mask = `linear-gradient(${dir}, transparent ${a}%, #000 ${a + step}%, #000 ${a + 2 * step}%, transparent ${a + 3 * step}%)`;
        const filter = `blur(calc(${blur}px * var(--pb-scale, 1)))`;
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{ backdropFilter: filter, WebkitBackdropFilter: filter, maskImage: mask, WebkitMaskImage: mask }}
          />
        );
      })}
      {/* tint so text over busy posters stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${dir}, transparent, color-mix(in oklab, var(--color-base) 88%, transparent))`,
        }}
      />
    </div>
  );
}
