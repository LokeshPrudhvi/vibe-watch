import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import SettingsIcon from "lucide-react-native/icons/settings";
import { Tap, Txt } from "@/components/ui";
import { useMotion } from "@/lib/motion";
import { alpha, fonts } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const ROW = 52;

/**
 * Scroll state for the large-title header. Only flips two booleans (React skips the re-render
 * when they don't change); the fades themselves run on the UI thread.
 */
export function useHeaderScroll(threshold = 56, solidAt = 4) {
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setScrolled(y > solidAt);
    setCollapsed(y > threshold);
  };
  return { scrolled, collapsed, onScroll };
}

/** Space above the large title so it starts just under the status bar. */
export const useHeaderSpace = () => useSafeAreaInsets().top + 8;

/** Big page title that scrolls away with the content (iOS large-title pattern). */
export function LargeTitle({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingRight: 72, paddingBottom: 12, minHeight: ROW }}>
      <Txt variant="small" muted numberOfLines={1} style={{ height: 18, fontSize: 12, fontWeight: "500" }}>
        {eyebrow ?? ""}
      </Txt>
      <Txt variant="title">{title}</Txt>
    </View>
  );
}

/**
 * Thin bar pinned to the top. It stays transparent at the top of the page, turns solid once you
 * scroll, and shows a small title after the big one has scrolled under it. Nothing here changes size.
 */
export function TopBar({
  title,
  scrolled,
  collapsed,
  back,
  settings = true,
  right,
}: {
  title: string;
  scrolled: boolean;
  collapsed: boolean;
  back?: boolean;
  settings?: boolean;
  right?: ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const bg = useSharedValue(0);
  const small = useSharedValue(0);

  useEffect(() => {
    bg.set(withTiming(scrolled ? 1 : 0, { duration: motion.duration(250) }));
  }, [scrolled, bg, motion]);
  useEffect(() => {
    small.set(withTiming(collapsed ? 1 : 0, { duration: motion.duration(200) }));
  }, [collapsed, small, motion]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.get() }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: small.get() }));

  return (
    <View pointerEvents="box-none" style={[styles.bar, { height: insets.top + ROW + 8 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: alpha(c.base, 0.96), borderBottomWidth: StyleSheet.hairlineWidth, borderColor: alpha(c.tint, 0.08) },
          bgStyle,
        ]}
      />
      <View style={[styles.row, { marginTop: insets.top + 4 }]}>
        {back && (
          <IconButton
            label="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            Icon={ArrowLeft}
            solid={!scrolled}
          />
        )}
        <Animated.Text
          numberOfLines={1}
          accessibilityElementsHidden={!collapsed}
          importantForAccessibility={collapsed ? "auto" : "no-hide-descendants"}
          style={[{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: c.ink, letterSpacing: -0.3 }, titleStyle]}
        >
          {title}
        </Animated.Text>
        {right}
        {settings && <IconButton label="Settings" onPress={() => router.push("/settings")} Icon={SettingsIcon} />}
      </View>
    </View>
  );
}

export function IconButton({
  Icon,
  label,
  onPress,
  size = 44,
  solid,
}: {
  Icon: typeof ArrowLeft;
  label: string;
  onPress: () => void;
  size?: number;
  /** stronger fill for buttons that sit over images */
  solid?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: solid ? alpha(c.card, 0.82) : alpha(c.tint, 0.08),
      }}
    >
      <Icon size={20} color={c.ink} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", top: 0, left: 0, right: 0 },
  row: { height: ROW - 8, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
});
