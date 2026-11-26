/** Settings controls: switch, segmented control, rows and grouped sections. */
import { Children, Fragment, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSurface } from "@/components/Glass";
import { Card, Txt } from "@/components/ui";
import { SPRING, useMotion } from "@/lib/motion";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const { c } = useTheme();
  const motion = useMotion();
  const spring = motion.spring(SPRING.toggle);
  const p = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    const to = checked ? 1 : 0;
    p.set(spring ? withSpring(to, spring) : to);
  }, [checked, p, spring]);

  const off = alpha(c.tint, 0.15);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], [off, c.ink]) }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: p.get() * 20 }],
    backgroundColor: interpolateColor(p.get(), [0, 1], [c.ink, c.inverse]),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        Haptics.selectionAsync();
        onChange(!checked);
      }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; Icon?: React.ComponentType<{ size?: number; color?: string }> }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const { c } = useTheme();
  const surface = useSurface();
  const motion = useMotion();
  const spring = motion.spring(SPRING.pill);
  const [width, setWidth] = useState(0);
  const seg = width ? (width - 8) / options.length : 0;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(-1);

  useEffect(() => {
    if (!seg) return;
    const to = index * seg;
    x.set(x.get() < 0 || !spring ? to : withSpring(to, spring));
  }, [index, seg, spring, x]);

  const pill = useAnimatedStyle(() => ({ opacity: x.get() < 0 ? 0 : 1, transform: [{ translateX: Math.max(0, x.get()) }] }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.segmented, surface("control")]}
    >
      {seg > 0 && (
        <Animated.View
          style={[styles.segPill, { width: seg }, surface("thumb"), pill]}
        />
      )}
      {options.map(({ value: v, label: l, Icon }) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (!on) Haptics.selectionAsync();
              onChange(v);
            }}
            style={styles.segItem}
          >
            {Icon && <Icon size={16} color={on ? c.ink : c.muted} />}
            <Txt variant="label" numberOfLines={1} style={{ color: on ? c.ink : c.muted }}>
              {l}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One settings row. Text never changes on toggle, so flipping a switch can't reflow the rows around it. */
export function SettingRow({
  title,
  description,
  children,
  disabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2, opacity: disabled ? 0.45 : 1 }}>
        <Txt variant="label" style={{ fontSize: 15 }}>
          {title}
        </Txt>
        {description ? (
          <Txt variant="small" muted>
            {description}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function SettingsSection({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const items = Children.toArray(children);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
        <Icon size={16} color={c.muted} />
        <Txt variant="eyebrow" muted style={{ fontSize: 12 }}>
          {title}
        </Txt>
      </View>
      <Card style={{ borderRadius: 24, overflow: "hidden" }}>
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: alpha(c.tint, 0.08) }} />}
            {child}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 52, height: 32, borderRadius: 16, padding: 4 },
  knob: { width: 24, height: 24, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" },
  segmented: { flexDirection: "row", borderRadius: 999, padding: 4 },
  segPill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 999 },
  segItem: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
});
