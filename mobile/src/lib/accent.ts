import { FALLBACK_HSL, accentFromPixels, hslToHex } from "@shared/accent";

export const FALLBACK_ACCENT = hslToHex(FALLBACK_HSL);

/**
 * Accent colour of a poster: Skia downloads and decodes a tiny (w92) poster, we read its
 * pixels and run the same colour maths as the web app (shared/accent.ts).
 * Skia is required lazily so it doesn't add to app start-up.
 */
export async function extractAccent(uri: string): Promise<string> {
  const { Skia, ColorType, AlphaType } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: keeps Skia out of start-up
    require("@shopify/react-native-skia") as typeof import("@shopify/react-native-skia");
  try {
    const data = await Skia.Data.fromURI(uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return FALLBACK_ACCENT;
    const width = image.width();
    const height = image.height();
    const pixels = image.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    return pixels instanceof Uint8Array ? hslToHex(accentFromPixels(pixels)) : FALLBACK_ACCENT;
  } catch {
    return FALLBACK_ACCENT;
  }
}
