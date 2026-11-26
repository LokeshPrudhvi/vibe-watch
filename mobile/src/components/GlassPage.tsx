import { useRef, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { BlurTargetView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetContext, useLiquidSurfaces } from "@/components/Glass";
import { useTrending } from "@/hooks/tmdb";
import { backdropUri, posterUri } from "@/lib/images";
import { useMotion } from "@/lib/motion";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/** What the page's ambient backdrop is made from: a TMDB backdrop (default) or poster path. */
export interface AmbientSource {
  path?: string | null;
  kind?: "backdrop" | "poster";
  /**
   * With no `path`, use this week's top trending backdrop (default). False = show nothing until
   * the page's own image is known, so it doesn't crossfade from an unrelated film while loading.
   */
  fallback?: boolean;
  /** no ambient at all (a page with its own hero image) */
  off?: boolean;
}

/**
 * A page liquid glass can live on.
 * - The content sits in the page's own BlurTargetView; `bar` (the TopBar and its buttons) sits
 *   OUTSIDE it and blurs it. Never move the bar inside: a BlurView inside the target it blurs
 *   loops Android's RenderNode graph and crashes the app on open (0.1.1/0.1.2). The content gets
 *   a null target, so glass inside it can't blur its own ancestor by accident.
 * - With Liquid glass on, a blurred, dimmed image from the page's own content sits behind
 *   everything, so the see-through cards and bars have colour to show.
 */
export function GlassPage({ ambient, bar, children }: { ambient?: AmbientSource; bar?: ReactNode; children: ReactNode }) {
  const { c } = useTheme();
  const target = useRef<ComponentRef<typeof View>>(null);
  return (
    <View style={{ flex: 1, backgroundColor: c.base }}>
      <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: c.base }}>
        <Ambient {...ambient} />
        <BlurTargetContext value={null}>{children}</BlurTargetContext>
      </BlurTargetView>
      <BlurTargetContext value={target}>{bar}</BlurTargetContext>
    </View>
  );
}

/**
 * Content-tinted light behind the page: a small TMDB image, blurred once at decode time (never a
 * live blur) and faded into the page colour. It stays put while the page scrolls over it, which
 * is what makes the glass read as glass. Falls back to this week's top trending backdrop.
 */
export function Ambient({ path, kind = "backdrop", fallback = true, off }: AmbientSource) {
  const { c, dark } = useTheme();
  const on = useLiquidSurfaces() && !off;
  const motion = useMotion();
  const { height } = useWindowDimensions();
  const trending = useTrending();
  const top = fallback ? trending.data?.find((m) => m.backdrop_path)?.backdrop_path : undefined;
  if (!on) return null;
  const uri = path ? (kind === "poster" ? posterUri(path, 154) : backdropUri(path)) : top ? backdropUri(top) : null;
  if (!uri) return null;

  return (
    <View pointerEvents="none" style={[styles.ambient, { height: Math.round(height * 0.62) }]}>
      <Image
        source={uri}
        blurRadius={dark ? 26 : 22}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={motion.off ? null : motion.duration(450)}
        style={[StyleSheet.absoluteFill, { opacity: dark ? 0.5 : 0.34, transform: [{ scale: 1.25 }] }]}
      />
      {/* fades into the page colour; light pages keep more of it so the top doesn't go murky */}
      <LinearGradient
        colors={[alpha(c.base, dark ? 0.25 : 0.3), alpha(c.base, dark ? 0.5 : 0.6), c.base]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ambient: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
});
