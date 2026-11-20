/**
 * Pulls a vivid accent colour out of a poster so every title gets its own theme.
 * Input is raw RGBA pixels from a tiny poster (web: a 40×60 canvas; mobile: Skia reading a w92 poster).
 * Buckets pixels by hue, weights by saturation, then boosts the winner so it always reads well.
 */
export type Hsl = [hue: number, saturation: number, lightness: number];

/** Neutral light grey, used until (or if) a poster gives us something better. */
export const FALLBACK_HSL: Hsl = [0, 0, 0.78];

export function accentFromPixels(data: ArrayLike<number>): Hsl {
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] < 128) continue; // transparent
    const [hue, s, l] = rgbToHsl(r, g, b);
    if (s < 0.25 || l < 0.12 || l > 0.9) continue; // skip greys, blacks, whites
    const wt = s * s * (1 - Math.abs(l - 0.5) * 1.4);
    const bucket = buckets[Math.floor(hue / 15) % 24];
    bucket.weight += wt;
    bucket.r += r * wt;
    bucket.g += g * wt;
    bucket.b += b * wt;
  }

  const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a));
  if (best.weight < 1) return FALLBACK_HSL;

  const [hue, s, l] = rgbToHsl(best.r / best.weight, best.g / best.weight, best.b / best.weight);
  return [Math.round(hue), Math.max(s, 0.65), Math.min(Math.max(l, 0.56), 0.7)];
}

/** CSS form for the web: "hsl(210 70% 60%)". */
export const hslCss = ([h, s, l]: Hsl) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

/** "#rrggbb", which every platform's colour parser accepts. */
export function hslToHex([h, s, l]: Hsl) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
