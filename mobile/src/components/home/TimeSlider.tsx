import { useEffect } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Moon from "lucide-react-native/icons/moon";
import { TIME_MAX, TIME_MIN } from "@shared/taste";
import { addMinutes, formatClock, formatDuration, minutesUntil } from "@shared/time";
import { Card, Tap, Txt } from "@/components/ui";
import { useNow } from "@/hooks/useUtils";
import { useMotion } from "@/lib/motion";
import { useVibeStore } from "@/store/vibe";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const STEP = 5;
const THUMB = 26;
const SLIDE = { stiffness: 380, damping: 32 };

const toPct = (m: number) => (m - TIME_MIN) / (TIME_MAX - TIME_MIN);

/**
 * "I've got 2h 10m". The thumb follows your finger on the UI thread; React only hears about it
 * when the value crosses a 5-minute step (with a haptic tick), so dragging never drops frames.
 */
export function TimeSlider() {
  const { c } = useTheme();
  const minutes = useVibeStore((s) => s.minutes);
  const setMinutes = useVibeStore((s) => s.setMinutes);
  const now = useNow();
  const motion = useMotion();
  const spring = motion.spring(SLIDE);

  const trackW = useSharedValue(0);
  const pos = useSharedValue(toPct(minutes));
  const step = useSharedValue(minutes);
  const dragging = useSharedValue(false);

  const onStep = (m: number) => {
    setMinutes(m);
    Haptics.selectionAsync();
  };

  // external changes (presets, accessibility actions) glide the thumb
  useEffect(() => {
    if (dragging.get()) return;
    step.set(minutes);
    pos.set(spring ? withSpring(toPct(minutes), spring) : toPct(minutes));
  }, [minutes, spring, pos, step, dragging]);

  const follow = (x: number) => {
    "worklet";
    const w = trackW.get();
    if (!w) return;
    const p = Math.min(1, Math.max(0, x / w));
    pos.set(p);
    const m = TIME_MIN + Math.round((p * (TIME_MAX - TIME_MIN)) / STEP) * STEP;
    if (m !== step.get()) {
      step.set(m);
      scheduleOnRN(onStep, m);
    }
  };

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      "worklet";
      dragging.set(true);
      follow(e.x);
    },
    onUpdate: (e) => {
      "worklet";
      follow(e.x);
    },
    onFinalize: () => {
      "worklet";
      dragging.set(false);
      const to = toPct(step.get());
      pos.set(spring ? withSpring(to, spring) : to);
    },
  });

  const fill = useAnimatedStyle(() => ({ width: pos.get() * trackW.get() }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: pos.get() * trackW.get() - THUMB / 2 }] }));

  const presets = [
    { label: "Before 11 PM", value: minutesUntil(23, now) },
    { label: "Before midnight", value: minutesUntil(0, now) },
  ].filter((p) => p.value >= TIME_MIN && p.value <= TIME_MAX);

  return (
    <Card style={{ padding: 20, marginHorizontal: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Txt variant="eyebrow" muted>
            Time-fit
          </Txt>
          <Txt variant="heading" style={{ fontSize: 24, lineHeight: 30, marginTop: 4 }}>
            I&apos;ve got <Txt variant="heading" style={{ fontSize: 24, lineHeight: 30, color: c.time }}>{formatDuration(minutes)}</Txt>
          </Txt>
        </View>
        <View style={{ borderRadius: 16, backgroundColor: alpha(c.tint, 0.05), paddingHorizontal: 12, paddingVertical: 8, alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Moon size={12} color={c.muted} />
            <Txt variant="caption" muted>
              Done by
            </Txt>
          </View>
          <Txt variant="label" style={{ fontVariant: ["tabular-nums"] }}>
            {formatClock(addMinutes(now, minutes))}
          </Txt>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Time available"
          accessibilityValue={{ text: formatDuration(minutes) }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => setMinutes(minutes + (e.nativeEvent.actionName === "increment" ? 15 : -15))}
          hitSlop={{ top: 8, bottom: 8 }}
          style={{ height: 44, justifyContent: "center", marginTop: 14 }}
        >
          <View
            onLayout={(e) => {
              trackW.set(e.nativeEvent.layout.width);
            }}
            style={{ height: 10, borderRadius: 5, backgroundColor: alpha(c.tint, 0.09), overflow: "hidden" }}
          >
            <Animated.View style={[{ height: "100%", borderRadius: 5, overflow: "hidden" }, fill]}>
              <LinearGradient
                colors={[alpha(c.tint, 0.28), c.ink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 0,
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: alpha("#000000", 0.08),
                boxShadow: `0 0 0 6px ${alpha(c.tint, 0.16)}, 0 6px 16px rgba(0,0,0,0.45)`,
              },
              thumb,
            ]}
          />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Txt variant="caption" muted>
          1h
        </Txt>
        <Txt variant="caption" muted>
          4h
        </Txt>
      </View>

      {presets.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {presets.map((p) => (
            <Tap
              key={p.label}
              onPress={() => setMinutes(Math.floor(p.value / STEP) * STEP)}
              style={{ borderRadius: 999, backgroundColor: alpha(c.tint, 0.06), paddingHorizontal: 12, paddingVertical: 8 }}
            >
              <Txt variant="label" style={{ fontSize: 12 }}>
                {p.label}
              </Txt>
            </Tap>
          ))}
        </View>
      )}
      <Txt variant="caption" muted style={{ marginTop: 14, fontSize: 12 }}>
        Only showing films that finish in time.
      </Txt>
    </Card>
  );
}
