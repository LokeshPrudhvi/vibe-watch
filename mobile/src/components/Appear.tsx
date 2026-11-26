import { useEffect, type ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useMotion } from "@/lib/motion";

/**
 * Fade (and optional rise) on mount, driven by a shared value that always ends at fully visible.
 *
 * Use this instead of Reanimated's layout `entering` animations. On Android's new architecture an
 * `entering` animation sometimes never starts when its view mounts mid-layout (during a screen
 * push, right after launch), and the view is left at opacity 0. That hid the Tonight pick (fixed
 * in 0.1.2) and blanked the movie page. Change `replay` to play it again without remounting.
 */
export function Appear({
  delay = 0,
  duration = 300,
  rise = 0,
  replay,
  style,
  children,
  ...rest
}: ViewProps & {
  delay?: number;
  duration?: number;
  /** px the view travels up while it fades in */
  rise?: number;
  replay?: unknown;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const motion = useMotion();
  const ms = motion.duration(duration);
  const wait = motion.duration(delay);
  const shown = useSharedValue(ms ? 0 : 1);

  useEffect(() => {
    if (!ms) {
      shown.set(1);
      return;
    }
    shown.set(0);
    const to = withTiming(1, { duration: ms, easing: Easing.out(Easing.cubic) });
    shown.set(wait ? withDelay(wait, to) : to);
  }, [replay, ms, wait, shown]);

  const animated = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * rise }],
  }));

  return (
    <Animated.View {...rest} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}
