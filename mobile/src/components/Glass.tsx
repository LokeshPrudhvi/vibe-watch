import { createContext, useCallback, useContext, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Platform, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from "react-native-svg";
import { useEffectiveGlass } from "@/store/settings";
import { alpha, type Palette } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/**
 * Android blurs a specific view (a BlurTargetView), not "whatever is behind". Pages wrap their
 * content in one (GlassPage) and share the ref here with their floating bars; glass outside any
 * target falls back to tinted glass.
 *
 * HARD RULE: a Glass must never sit inside the BlurTargetView it blurs. That loops Android's
 * RenderNode graph, the RenderThread overflows its stack and the app dies on open (0.1.1/0.1.2).
 * So content always gets a null target, and in-content glass brings its own sibling target.
 */
export const BlurTargetContext = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);

const nativeLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
const androidBlur = Platform.OS === "android" && Number(Platform.Version) >= 31;

interface Live {
  tint: BlurTint;
  /** expo-blur intensity: drives both the blur and its tint coat (coat alpha ≈ intensity/100 × 0.55–0.78) */
  intensity: number;
  /** Android blur radius px = intensity × 4 / reduction, so a low reduction = strong blur, thin coat */
  reduction: number;
  /** our own card-colour coat on top */
  fill: number;
}

/**
 * Liquid (Kyant0/backdrop, as in BitChord): a thin coat over a moderate blur, so shapes and colour
 * behind the glass stay readable: about 26% dark / 32% light in all, where the old glass was over
 * 40% / 50%. Icons stay legible through their halo (useGlassInk), not through a thicker coat.
 * Bars carry text, so they keep a thicker coat. Reduced: a lighter blur under a more solid coat,
 * as before. Classic: the old frosted look.
 * No colour-matrix "vibrancy" layer: RN draws a filter as an extra offscreen layer that re-renders
 * every frame, which more than doubled the frame cost of scrolling under the navbar.
 * iOS: expo-blur's intensity is the strength of a system material there, not a radius, so it
 * gets the system's own thin materials at a normal strength.
 */
function liveTuning(liquid: boolean, reduced: boolean, dark: boolean, bar: boolean): Live {
  if (reduced) return { tint: dark ? "dark" : "light", intensity: 30, reduction: 4, fill: 0.78 };
  if (liquid && Platform.OS === "ios") {
    return { tint: dark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight", intensity: 80, reduction: 4, fill: bar ? 0.2 : 0.06 };
  }
  if (liquid) {
    return dark
      ? { tint: "systemUltraThinMaterialDark", intensity: bar ? 30 : 26, reduction: bar ? 2 : 2.2, fill: bar ? 0.36 : 0.14 }
      : { tint: "light", intensity: bar ? 26 : 22, reduction: bar ? 2 : 2.2, fill: bar ? 0.45 : 0.18 };
  }
  return { tint: dark ? "dark" : "light", intensity: 60, reduction: 4, fill: 0.62 };
}

/**
 * Floating live glass: the navbar, page bars and their buttons, the Next button.
 * - iOS 26+, Liquid glass on: the system's own Liquid Glass
 * - iOS otherwise: UIVisualEffectView blur
 * - Android 12+: RenderEffect blur of the page behind (BlurTargetView)
 * - "Better performance for glass", older Android, or no target: tinted glass, no blur
 * `variant="bar"` is a full-width top bar: no rim, no shadow, a hairline at the bottom.
 */
export function Glass({
  radius,
  style,
  children,
  interactive,
  variant = "float",
  strong,
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  interactive?: boolean;
  variant?: "float" | "bar";
  /** more coat, for small buttons that sit on busy images */
  strong?: boolean;
}) {
  const { c, dark } = useTheme();
  const g = useEffectiveGlass();
  const target = useContext(BlurTargetContext);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const bar = variant === "bar";

  if (nativeLiquidGlass && g.liquid && g.blur) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={dark ? "dark" : "light"}
        isInteractive={interactive}
        style={[{ borderRadius: radius }, style]}
      >
        {children}
      </GlassView>
    );
  }

  const blur = g.blur && (Platform.OS === "ios" || (androidBlur && !!target));
  const live = liveTuning(g.liquid, g.reduced, dark, bar);
  // without a live blur the glass has to hide busy content on its own; a blurless bar is the old solid bar
  const fill = !blur ? (bar ? 0.96 : g.liquid && !g.perf ? 0.86 : 0.94) : strong ? Math.max(live.fill, 0.42) : live.fill;
  const coat = bar && !blur ? c.base : c.card;
  const rim = g.liquid && !bar && size.w > 0;

  return (
    <View
      style={[{ borderRadius: radius }, !bar && { boxShadow: `0 14px 36px -10px ${c.shadow}` }, style]}
      onLayout={g.liquid && !bar ? (e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }) : undefined}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]} pointerEvents="none">
        {blur && (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={live.intensity}
            blurReductionFactor={live.reduction}
            tint={live.tint}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={target ?? undefined}
          />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(coat, fill) }]} />
        {g.liquid && !bar && (
          <LinearGradient
            colors={[alpha("#ffffff", dark ? 0.14 : 0.5), "transparent", "transparent", alpha("#ffffff", dark ? 0.06 : 0.2)]}
            locations={[0, 0.4, 0.7, 1]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {bar ? (
          <View style={[styles.barEdge, { backgroundColor: alpha(c.tint, g.liquid ? 0.1 : 0.08) }]} />
        ) : rim ? (
          // specular rim: bright where the light hits (top-left, a kick bottom-right), dim between
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGradient id="rim" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={dark ? 0.8 : 1} />
                <Stop offset="0.28" stopColor="#ffffff" stopOpacity={0.14} />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.03} />
                <Stop offset="0.72" stopColor="#ffffff" stopOpacity={0.14} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={dark ? 0.45 : 0.7} />
              </SvgGradient>
            </Defs>
            <Rect
              x={0.75}
              y={0.75}
              width={Math.max(0, size.w - 1.5)}
              height={Math.max(0, size.h - 1.5)}
              rx={Math.max(0, Math.min(radius, size.h / 2) - 0.75)}
              fill="none"
              stroke="url(#rim)"
              strokeWidth={1.5}
            />
          </Svg>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: radius,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: alpha(c.tint, 0.09),
                borderBottomColor: alpha(c.tint, 0.06),
              },
            ]}
          />
        )}
      </View>
      {children}
    </View>
  );
}

/**
 * Ink for icons and labels sitting on live glass. Clear liquid glass lets bright posters through,
 * so it gets a soft halo (a dark glow on dark glass, a light one on light glass) and a brighter
 * "inactive" colour than c.muted, which vanished over bright posters. Solid glass (reduced blur,
 * performance mode) needs neither, so it skips the halo's RenderEffect.
 */
export function useGlassInk() {
  const { c, dark } = useTheme();
  const g = useEffectiveGlass();
  const clear = g.liquid && !g.reduced && g.blur;
  const glow = dark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.9)";
  // Android: a drop-shadow filter; iOS: a layer shadow, which follows the icon's own shape
  const halo: ViewStyle | undefined = !clear
    ? undefined
    : Platform.OS === "android"
      ? { filter: [{ dropShadow: { offsetX: 0, offsetY: 0.5, standardDeviation: 2.5, color: glow } }] }
      : { shadowColor: glow, shadowOpacity: 1, shadowRadius: 2.5, shadowOffset: { width: 0, height: 0.5 } };
  const textHalo: TextStyle | undefined = clear
    ? { textShadowColor: glow, textShadowRadius: 5, textShadowOffset: { width: 0, height: 0.5 } }
    : undefined;
  return { ink: c.ink, soft: clear ? alpha(c.ink, dark ? 0.8 : 0.74) : c.muted, halo, textHalo };
}

/* ---------- Static liquid glass for surfaces inside the page (no BlurView) ---------- */

/**
 * - card: cards and grouped sections
 * - tile: unselected selectable chips (mood, language)
 * - chip: small tags and info boxes
 * - control: pill and round buttons
 * - thumb: the selected segment of a segmented control
 * - overlay: small buttons that sit on top of posters
 */
export type SurfaceKind = "card" | "tile" | "chip" | "control" | "thumb" | "overlay";

const HAIR = StyleSheet.hairlineWidth;

/** Liquid glass off: exactly the solid surfaces the app had before. */
function classic(kind: SurfaceKind, c: Palette): ViewStyle {
  switch (kind) {
    case "card":
      return { backgroundColor: c.card, borderWidth: HAIR, borderColor: alpha(c.tint, 0.06) };
    case "tile":
      return { backgroundColor: c.card, borderWidth: 1, borderColor: alpha(c.tint, 0.05) };
    case "chip":
      return { backgroundColor: alpha(c.tint, 0.07) };
    case "control":
      return { backgroundColor: alpha(c.tint, 0.08) };
    case "thumb":
      return { backgroundColor: c.card, borderWidth: HAIR, borderColor: alpha(c.tint, 0.1), boxShadow: `0 1px 3px ${alpha("#000000", 0.18)}` };
    case "overlay":
      return { backgroundColor: alpha(c.card, 0.85), borderWidth: 1, borderColor: alpha(c.tint, 0.1) };
  }
}

/**
 * Liquid glass on: a thin, see-through layer with a lit inner rim (inset shadows: a bright top
 * edge and a faint ring) instead of a solid fill. No live blur, so it costs nothing to scroll; the
 * page's ambient backdrop is what shows through. Light glass on a white card would vanish, so its
 * small parts are a faint gray bead with a dark hairline ring instead of white on white.
 * Each kind keeps the classic border width (transparent), so flipping the setting moves nothing.
 * Drop shadows only in light mode: on a near-black page they can't be seen, but every live blur
 * redraws the page, so they would still cost a blurred draw per surface several times a frame.
 */
function liquid(kind: SurfaceKind, dark: boolean): ViewStyle {
  const top = dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.95)";
  const ring = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  // inset highlights stay unblurred: any blur there forces Skia's slow masked path on every frame
  const rim = `inset 0 1px 0 ${top}, inset 0 0 0 0.5px ${ring}`;
  const drop = (shadow: string) => (dark ? "" : `, ${shadow} rgba(0,0,0,0.2)`);
  const bead = dark ? "rgba(255,255,255,0.08)" : "rgba(118,118,128,0.1)";
  const edge = (borderWidth: number): ViewStyle => ({ borderWidth, borderColor: "transparent" });
  switch (kind) {
    case "card":
      return { ...edge(HAIR), backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)", boxShadow: `${rim}${drop("0 16px 32px -20px")}` };
    case "tile":
      return { ...edge(1), backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.62)", boxShadow: `${rim}${drop("0 2px 6px -3px")}` };
    case "chip":
      return { backgroundColor: bead, boxShadow: rim };
    case "control":
      return { backgroundColor: dark ? "rgba(255,255,255,0.1)" : "rgba(118,118,128,0.12)", boxShadow: rim };
    case "thumb":
      return {
        ...edge(HAIR),
        backgroundColor: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.95)",
        boxShadow: `inset 0 1px 0 ${dark ? "rgba(255,255,255,0.35)" : "#ffffff"}, inset 0 0 0 0.5px ${ring}${drop("0 3px 8px -3px")}`,
      };
    case "overlay":
      return {
        ...edge(1),
        backgroundColor: dark ? "rgba(0,0,0,0.58)" : "rgba(255,255,255,0.84)",
        boxShadow: `inset 0 1px 0 ${top}, inset 0 0 0 0.5px ${dark ? "rgba(255,255,255,0.16)" : ring}${drop("0 4px 12px -4px")}`,
      };
  }
}

/** Android before 10 drops inset shadows (and before 9 all box shadows), which are the liquid rim. */
const insetShadows = Platform.OS !== "android" || Number(Platform.Version) >= 29;

/**
 * `surface("card")` → the style for that surface in the current theme and glass mode.
 * Performance mode and old Android keep the classic solid surfaces.
 */
export function useSurface() {
  const { c, dark } = useTheme();
  const g = useEffectiveGlass();
  const on = g.liquid && !g.perf && insetShadows;
  return useCallback((kind: SurfaceKind): ViewStyle => (on ? liquid(kind, dark) : classic(kind, c)), [on, dark, c]);
}

/** True when pages draw see-through liquid surfaces (and so get an ambient backdrop). */
export function useLiquidSurfaces() {
  const g = useEffectiveGlass();
  return g.liquid && !g.perf && insetShadows;
}

const styles = StyleSheet.create({
  barEdge: { position: "absolute", left: 0, right: 0, bottom: 0, height: HAIR },
});
