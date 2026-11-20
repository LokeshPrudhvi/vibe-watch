import { PixelRatio } from "react-native";
import { tmdbImage, type ImgSize } from "@shared/tmdb";

const POSTER_WIDTHS = [92, 154, 185, 342, 500] as const;
// Above 2.5× the extra pixels are hard to see on a poster thumbnail but cost memory and data.
const density = Math.min(PixelRatio.get(), 2.5);

/** Smallest TMDB poster that is sharp at `dpWidth` on this screen. */
export function posterUri(path: string | null | undefined, dpWidth: number) {
  const px = dpWidth * density;
  const w = POSTER_WIDTHS.find((s) => s >= px) ?? 500;
  return tmdbImage(path, `w${w}` as ImgSize);
}

/** Backdrops are only ever shown blurred or dimmed, so a small one is plenty. */
export const backdropUri = (path: string | null | undefined, large = false) =>
  tmdbImage(path, large ? "w780" : "w300");

export const logoUri = (path: string | null | undefined) => tmdbImage(path, "w92");
