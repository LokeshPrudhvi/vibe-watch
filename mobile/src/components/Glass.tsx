import { createContext, useContext, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from "react-native-svg";
import { useEffectiveGlass } from "@/store/settings";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/**
 * Android blurs a specific view (a BlurTargetView), not "whatever is behind". The tab layout wraps
 * its screens in one and shares the ref here; glass outside any target falls back to tinted glass.
 */
export const BlurTargetContext = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);

const nativeLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
const androidBlur = Platform.OS === "android" && Number(Platform.Version) >= 31;

/**
 * Floating glass surface. Live blur is reserved for small floating parts (the navbar):
 * - iOS 26+, Liquid glass on: the system's own Liquid Glass
 * - iOS otherwise: UIVisualEffectView blur
 * - Android 12+: RenderEffect blur of the screen behind (BlurTargetView)
 * - "Better performance for glass", older Android, or no target: mostly opaque tint, no blur
 */
export function Glass({
  radius,
  style,
  children,
  interactive,
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  interactive?: boolean;
}) {
  const { c, dark } = useTheme();
  const g = useEffectiveGlass();
  const target = useContext(BlurTargetContext);
  const shadow: ViewStyle = { boxShadow: `0 14px 36px -10px ${c.shadow}` };
  const [size, setSize] = useState({ w: 0, h: 0 });

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
  // how much card colour covers the blur. Liquid (Kyant0/backdrop-style, as in BitChord) is
  // nearly clear with a light blur so what's behind stays vivid; reduced/no-blur is more solid.
  const fill = !blur ? 0.94 : g.reduced ? 0.8 : g.liquid ? (dark ? 0.2 : 0.32) : 0.62;
  const rim = g.liquid && size.w > 0;

  return (
    <View
      style={[{ borderRadius: radius }, shadow, style]}
      onLayout={g.liquid ? (e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }) : undefined}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]} pointerEvents="none">
        {blur && (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={g.reduced ? 30 : g.liquid ? 38 : 60}
            tint={dark ? "dark" : "light"}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={target ?? undefined}
          />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(c.card, fill) }]} />
        {g.liquid && (
          <LinearGradient
            colors={[alpha("#ffffff", dark ? 0.16 : 0.55), "transparent", "transparent", alpha("#ffffff", dark ? 0.05 : 0.18)]}
            locations={[0, 0.42, 0.72, 1]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {rim ? (
          // specular rim: bright where the light hits (top-left, a kick bottom-right), dim between
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGradient id="rim" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={dark ? 0.75 : 1} />
                <Stop offset="0.28" stopColor="#ffffff" stopOpacity={0.1} />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
                <Stop offset="0.72" stopColor="#ffffff" stopOpacity={0.1} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={dark ? 0.4 : 0.6} />
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
