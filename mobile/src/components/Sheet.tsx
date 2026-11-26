import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Tap, Txt } from "@/components/ui";
import { useMotion } from "@/lib/motion";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/**
 * A bottom sheet in its own window (an RN Modal), for options that shouldn't cost the page a row.
 * - Solid, not live glass: a BlurView here would have nothing of the page to blur in the modal's
 *   own window.
 * - Gestures inside a Modal need their own GestureHandlerRootView on Android.
 * - Tap outside, the back button or Done closes it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const motion = useMotion();
  return (
    <Modal
      visible={open}
      transparent
      animationType={motion.off ? "none" : "fade"}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SheetBody title={title} onClose={onClose}>
          {children}
        </SheetBody>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SheetBody({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  // mounts on every open, so the rise always starts from the bottom and lands at 0
  const ms = motion.duration(280);
  const rise = useSharedValue(ms ? 1 : 0);
  useEffect(() => {
    rise.set(ms ? withTiming(0, { duration: ms, easing: Easing.out(Easing.cubic) }) : 0);
  }, [ms, rise]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: rise.get() * 56 }] }));

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", dark ? 0.55 : 0.35) }]}
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: c.card2,
            borderColor: alpha(c.tint, 0.08),
            paddingBottom: Math.max(insets.bottom, 12) + 12,
            boxShadow: `0 -12px 40px -12px ${c.shadow}`,
          },
          slide,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: alpha(c.tint, 0.18) }]} />
        <View style={styles.head}>
          <Txt variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title ?? ""}
          </Txt>
          <Tap onPress={onClose} accessibilityLabel="Done" hitSlop={8} style={[styles.done, { backgroundColor: alpha(c.tint, 0.1) }]}>
            <Txt variant="label">Done</Txt>
          </Tap>
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth: 576,
    alignSelf: "center",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  done: { height: 36, borderRadius: 999, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
});
