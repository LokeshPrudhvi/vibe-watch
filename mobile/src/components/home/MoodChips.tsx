import { useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Brain from "lucide-react-native/icons/brain";
import Coffee from "lucide-react-native/icons/coffee";
import Smile from "lucide-react-native/icons/smile";
import Zap from "lucide-react-native/icons/zap";
import { MOODS, MOOD_ORDER, type MoodId } from "@shared/moods";
import { useSurface } from "@/components/Glass";
import { Tap, Txt } from "@/components/ui";
import { SPRING, useMotion } from "@/lib/motion";
import { useVibeStore } from "@/store/vibe";
import { useTheme } from "@/theme/useTheme";

const ICONS: Record<MoodId, typeof Brain> = { cozy: Coffee, mind: Brain, feel: Smile, edge: Zap };

/** Mood picker. The coloured pill slides to the chosen mood on the UI thread. */
export function MoodChips() {
  const { c } = useTheme();
  const surface = useSurface();
  const mood = useVibeStore((s) => s.mood);
  const setMood = useVibeStore((s) => s.setMood);
  const motion = useMotion();
  const spring = motion.spring(SPRING.chip);
  const frames = useRef<Partial<Record<MoodId, { x: number; w: number }>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const color = useSharedValue<string>(c[mood]);

  const moveTo = (id: MoodId, animate: boolean) => {
    const f = frames.current[id];
    if (!f) return;
    const go = (v: number) => (animate && spring ? withSpring(v, spring) : v);
    x.set(go(f.x));
    w.set(go(f.w));
    color.set(animate && !motion.off ? withTiming(c[id], { duration: motion.duration(250) }) : c[id]);
  };

  useEffect(() => {
    moveTo(mood, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, c]);

  const pill = useAnimatedStyle(() => ({
    width: w.get(),
    transform: [{ translateX: x.get() }],
    backgroundColor: color.get(),
    opacity: w.get() > 0 ? 1 : 0,
  }));

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999 }, pill]} />
        {MOOD_ORDER.map((id) => {
          const on = id === mood;
          const Icon = ICONS[id];
          return (
            <Tap
              key={id}
              accessibilityState={{ selected: on }}
              accessibilityLabel={MOODS[id].label}
              onLayout={(e) => {
                const { x: fx, width } = e.nativeEvent.layout;
                frames.current[id] = { x: fx, w: width };
                if (id === mood) moveTo(id, false);
              }}
              onPress={() => {
                if (!on) Haptics.selectionAsync();
                setMood(id);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderRadius: 999,
                ...(on ? { backgroundColor: "transparent", borderWidth: 1, borderColor: "transparent" } : surface("tile")),
              }}
            >
              <Icon size={16} color={on ? c.night : c[id]} />
              <Txt variant="label" style={{ color: on ? c.night : c.ink }}>
                {MOODS[id].label}
              </Txt>
            </Tap>
          );
        })}
      </ScrollView>
      <Animated.View key={mood} entering={motion.off ? undefined : FadeInDown.duration(200)}>
        <Txt variant="small" muted style={{ marginTop: 12, paddingHorizontal: 16 }}>
          {MOODS[mood].tagline}
        </Txt>
      </Animated.View>
    </View>
  );
}
