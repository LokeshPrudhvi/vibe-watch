import { createContext, useContext, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
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
  // how much card colour covers the blur: liquid is clearer, reduced/no-blur is more solid
  const fill = !blur ? 0.94 : g.reduced ? 0.8 : g.liquid ? 0.42 : 0.62;

  return (
    <View style={[{ borderRadius: radius }, shadow, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]} pointerEvents="none">
        {blur && (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={g.reduced ? 30 : 60}
            tint={dark ? "dark" : "light"}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={target ?? undefined}
          />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(c.card, fill) }]} />
        {g.liquid && blur && (
          <LinearGradient
            colors={[alpha("#ffffff", dark ? 0.12 : 0.47), "transparent", "transparent", alpha("#ffffff", dark ? 0.04 : 0.15)]}
            locations={[0, 0.38, 0.7, 1]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: g.liquid ? c.highlight : alpha(c.tint, 0.09),
              borderBottomColor: alpha(c.tint, 0.06),
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}
