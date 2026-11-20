/**
 * Pulls a vivid accent colour out of a poster so every title gets its own theme.
 * Draws it onto a tiny 40×60 canvas; the colour maths lives in shared/accent.ts (also used by the phone app).
 */
import { FALLBACK_HSL, accentFromPixels, hslCss } from "../../shared/accent";

export const FALLBACK_ACCENT = hslCss(FALLBACK_HSL);

const cache = new Map<string, string>();

export function extractAccent(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // image.tmdb.org serves CORS headers
    img.decoding = "async";
    img.onload = () => {
      try {
        const colour = dominantVivid(img);
        cache.set(src, colour);
        resolve(colour);
      } catch {
        resolve(FALLBACK_ACCENT);
      }
    };
    img.onerror = () => resolve(FALLBACK_ACCENT);
    img.src = src;
  });
}

function dominantVivid(img: HTMLImageElement): string {
  const w = 40;
  const h = 60;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return FALLBACK_ACCENT;
  ctx.drawImage(img, 0, 0, w, h);
  return hslCss(accentFromPixels(ctx.getImageData(0, 0, w, h).data));
}
