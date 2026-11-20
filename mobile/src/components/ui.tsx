/**
 * Small building blocks shared by every screen: text styles, a press-to-shrink button,
 * chips, skeletons and section titles.
 */
import { useEffect, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SPRING, useMotion } from "@/lib/motion";
import { alpha, fonts } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/* ---------- Text ---------- */

type Variant = "hero" | "title" | "heading" | "body" | "small" | "caption" | "eyebrow" | "label";

const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 14 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
};

export function Txt({
  variant = "body",
  color,
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; muted?: boolean }) {
  const { c } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[VARIANTS[variant], { color: color ?? (muted ? c.muted : c.ink) }, style]}
    />
  );
}

/* ---------- Press-to-shrink button (scale runs on the UI thread) ---------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Tap({
  scaleTo = 0.94,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const motion = useMotion();
  const scale = useSharedValue(1);
  const spring = motion.spring(SPRING.press);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        if (spring) scale.set(withSpring(scaleTo, spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(spring ? withSpring(1, spring) : 1);
        onPressOut?.(e);
      }}
      style={[style, animated, rest.disabled && { opacity: 0.4 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ---------- Chips ---------- */

export function Chip({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: alpha(c.tint, 0.07) }, style]}>
      <Txt variant="small" style={{ fontSize: 12, color: alpha(c.ink, 0.8) }}>
        {label}
      </Txt>
    </View>
  );
}

/* ---------- Skeleton (pulse runs on the UI thread) ---------- */

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const motion = useMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (motion.off) return;
    o.set(withRepeat(withSequence(withTiming(0.45, { duration: 700 }), withTiming(1, { duration: 700 })), -1));
  }, [motion.off, o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ borderRadius: 16, backgroundColor: alpha(c.tint, 0.06) }, style, animated]} />;
}

/* ---------- Section title ---------- */

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Txt variant="heading">{title}</Txt>
      {subtitle ? (
        <Txt variant="caption" muted style={{ fontSize: 12, lineHeight: 16 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

/** Rounded card surface used for empty states and settings groups. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { borderRadius: 28, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(c.tint, 0.06) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <Card style={{ padding: 28, alignItems: "center", gap: 12 }}>
      {children}
      <Txt variant="small" muted style={{ textAlign: "center" }}>
        {text}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
