/** Same design tokens as the web app (src/styles/index.css), as plain colours. */
const dark = {
  base: "#0e0e0e",
  card: "#1a1a1a",
  card2: "#252525",
  ink: "#f5f5f5",
  muted: "#a3a3a3",
  /** overlay colour: white on dark, black on light (use with alpha()) */
  tint: "#ffffff",
  /** text/icons sitting on an ink-coloured fill */
  inverse: "#0e0e0e",
  /** dark text on bright fills */
  night: "#111111",
  cozy: "#ff9f5a",
  mind: "#b18cff",
  feel: "#ffd23f",
  edge: "#ff4d74",
  time: "#e5e5e5",
  match: "#7cf29a",
  /** glass rim light */
  highlight: "rgba(255,255,255,0.22)",
  shadow: "rgba(0,0,0,0.55)",
};

export type Palette = typeof dark;

const light: Palette = {
  ...dark,
  base: "#f2f2f2",
  card: "#ffffff",
  card2: "#e9e9e9",
  ink: "#141414",
  muted: "#6b6b6b",
  tint: "#000000",
  inverse: "#f5f5f5",
  feel: "#e3a600",
  time: "#1f1f1f",
  match: "#1fa855",
  highlight: "rgba(255,255,255,0.85)",
  shadow: "rgba(0,0,0,0.22)",
};

export const palettes = { dark, light };

export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  displayBold: "BricolageGrotesque_700Bold",
};

/** Floating navbar height: big, thumb-friendly targets. */
export const BAR = 64;

const hex2 = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0");

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "#rrggbb" + opacity → "#rrggbbaa". */
export function alpha(hex: string, a: number) {
  const [r, g, b] = parse(hex);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a * 255)}`;
}

/** Mixes two "#rrggbb" colours; `t` is the share of `a` (like CSS color-mix). */
export function mix(a: string, b: string, t: number) {
  const x = parse(a);
  const y = parse(b);
  return `#${hex2(x[0] * t + y[0] * (1 - t))}${hex2(x[1] * t + y[1] * (1 - t))}${hex2(x[2] * t + y[2] * (1 - t))}`;
}
