/** Error card, toast, match ring and the Love / Save / Seen / Not for me buttons. */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import Bookmark from "lucide-react-native/icons/bookmark";
import Eye from "lucide-react-native/icons/eye";
import Heart from "lucide-react-native/icons/heart";
import ThumbsDown from "lucide-react-native/icons/thumbs-down";
import Undo2 from "lucide-react-native/icons/undo-2";
import type { MarkType, MovieLite } from "@shared/recommend";
import { ApiError, isReleased, isRetryable } from "@shared/tmdb";
import { Appear } from "@/components/Appear";
import { useSurface } from "@/components/Glass";
import { Card, Tap, Txt } from "@/components/ui";
import { API_BASE } from "@/lib/api";
import { useMotion } from "@/lib/motion";
import { useMarked, useVibeStore } from "@/store/vibe";
import { useToast } from "@/store/ui";
import { BAR, alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/* ---------- Error card ---------- */

function describe(error: unknown) {
  const api = error instanceof ApiError ? error : undefined;
  if (api?.code === "MISSING_TMDB_TOKEN" && __DEV__) {
    return {
      title: "The proxy has no TMDB token",
      body: `${API_BASE} is running without TMDB_TOKEN. Add it to the proxy's secrets (or .env.local for the dev server) and try again.`,
    };
  }
  if (api?.code === "NETWORK") {
    return __DEV__
      ? { title: "Can't reach the movie server", body: `Tried ${API_BASE}. Check your connection, or that the dev server is running.` }
      : { title: "You're offline", body: "Check your connection and try again." };
  }
  if (api?.code === "RATE_LIMITED" || api?.code === "UPSTREAM_RATE_LIMITED") {
    return { title: "Slow down a little", body: "Too many requests right now. Try again in a moment." };
  }
  return { title: "Couldn't load movies", body: "Something went wrong on our side. Please try again." };
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { c } = useTheme();
  const surface = useSurface();
  const { title, body } = describe(error);
  const canRetry = !!onRetry && (isRetryable(error) || (error instanceof ApiError && error.code.includes("RATE_LIMITED")));
  return (
    <Card style={{ padding: 22, gap: 8, borderColor: alpha(c.edge, 0.4), borderWidth: 1 }}>
      <Txt variant="heading" accessibilityRole="alert">
        {title}
      </Txt>
      <Txt variant="small" muted>
        {body}
      </Txt>
      {__DEV__ && error instanceof Error && (
        <Txt variant="caption" muted style={{ fontFamily: "monospace", opacity: 0.7 }}>
          {error.message}
        </Txt>
      )}
      {canRetry && (
        <Tap onPress={onRetry} style={[styles.pillButton, surface("control"), { alignSelf: "flex-start", marginTop: 6 }]}>
          <Txt variant="label">Try again</Txt>
        </Tap>
      )}
    </Card>
  );
}

/* ---------- Toast ---------- */

export function Toaster() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);
  // the wrapper stays mounted; each toast fades up on its own key
  return (
    <View pointerEvents="box-none" style={[styles.toastWrap, { bottom: Math.max(insets.bottom, 12) + BAR + 14 }]}>
      {toast && (
        <Appear
          key={toast.id}
          duration={220}
          rise={14}
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              backgroundColor: alpha(c.card2, 0.97),
              borderColor: alpha(c.tint, 0.1),
              boxShadow: `0 14px 36px -10px ${c.shadow}`,
            },
          ]}
        >
          <Txt variant="small" style={{ flexShrink: 1, fontWeight: "500" }}>
            {toast.text}
          </Txt>
          {toast.undo && (
            <Tap
              onPress={() => {
                toast.undo?.();
                dismiss();
              }}
              style={[styles.undo, { backgroundColor: alpha(c.tint, 0.1) }]}
            >
              <Undo2 size={16} color={c.ink} />
              <Txt variant="label">Undo</Txt>
            </Tap>
          )}
        </Appear>
      )}
    </View>
  );
}

/* ---------- Match ring (stroke animates on the UI thread) ---------- */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function MatchRing({ value, size = 56 }: { value: number; size?: number }) {
  const { c } = useTheme();
  const motion = useMotion();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    const to = value / 100;
    p.set(motion.off ? to : withTiming(to, { duration: motion.duration(900), easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [value, p, motion]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.get()) }));

  return (
    <View
      accessible
      accessibilityLabel={`${value}% taste match`}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={alpha(c.tint, 0.1)} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.match}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={props}
        />
      </Svg>
      <Txt style={{ fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
        {value}
        <Txt variant="caption" muted style={{ fontSize: 9 }}>
          %
        </Txt>
      </Txt>
    </View>
  );
}

/* ---------- Love / Save / Seen / Not for me ---------- */

const ACTIONS: {
  type: MarkType;
  label: string;
  on: string;
  /** label in the compact icon row, when it differs */
  short?: string;
  Icon: typeof Heart;
  toast?: string;
  needsRelease?: boolean;
}[] = [
  { type: "like", label: "Love", on: "Loved", Icon: Heart, needsRelease: true },
  { type: "save", label: "Save", on: "Saved", Icon: Bookmark },
  { type: "seen", label: "Seen it", on: "Seen", short: "Seen", Icon: Eye, toast: "Marked as seen. We won't suggest it again.", needsRelease: true },
  { type: "dislike", label: "Not for me", on: "Hidden", Icon: ThumbsDown, toast: "Got it. Less like this from now on." },
];

/**
 * The explicit feedback that trains the recommender. `compact`: one row of equal icon buttons
 * with small labels (the Tonight card).
 * A film that isn't out yet can only be saved or dismissed: nobody has seen or loved it.
 */
export function FeedbackButtons({ movie, compact }: { movie: MovieLite; compact?: boolean }) {
  const mark = useVibeStore((s) => s.mark);
  const unmark = useVibeStore((s) => s.unmark);
  const marks = useVibeStore((s) => s.marks);
  const show = useToast((s) => s.show);
  const released = isReleased(movie.date, movie.status);
  // keep an already-set Love/Seen visible on unreleased titles so it can still be undone
  const visible = ACTIONS.filter(
    (a) => released || !a.needsRelease || marks.some((m) => m.type === a.type && m.movie.id === movie.id),
  );

  return (
    <View style={compact ? { flexDirection: "row", gap: 6 } : { flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {visible.map((a) => (
        <FeedbackButton
          key={a.type}
          action={a}
          id={movie.id}
          compact={compact}
          onToggle={(active) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (active) return unmark(a.type, movie.id);
            // snapshot so Undo restores whatever this replaced (e.g. a Save cleared by Seen)
            const before = useVibeStore.getState().marks;
            mark(a.type, movie);
            if (a.toast) show(a.toast, () => useVibeStore.setState({ marks: before }));
          }}
        />
      ))}
    </View>
  );
}

function FeedbackButton({
  action,
  id,
  compact,
  onToggle,
}: {
  action: (typeof ACTIONS)[number];
  id: number;
  compact?: boolean;
  onToggle: (active: boolean) => void;
}) {
  const { c } = useTheme();
  const surface = useSurface();
  const active = useMarked(action.type, id);
  const { Icon } = action;
  const fg = active ? c.inverse : c.ink;
  if (compact) {
    return (
      <Tap
        scaleTo={0.9}
        onPress={() => onToggle(active)}
        accessibilityLabel={action.label}
        accessibilityState={{ selected: active }}
        style={[
          { flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2 },
          active ? { backgroundColor: c.ink } : surface("control"),
        ]}
      >
        <Icon size={17} color={fg} fill={active && action.type === "like" ? fg : "none"} />
        <Txt variant="caption" numberOfLines={1} style={{ fontSize: 10.5, lineHeight: 13, fontWeight: "600", color: fg }}>
          {active ? action.on : (action.short ?? action.label)}
        </Txt>
      </Tap>
    );
  }
  return (
    <Tap
      scaleTo={0.92}
      onPress={() => onToggle(active)}
      accessibilityLabel={action.label}
      accessibilityState={{ selected: active }}
      style={[styles.pillButton, active ? { backgroundColor: c.ink } : surface("control")]}
    >
      <Icon size={16} color={fg} fill={active && action.type === "like" ? fg : "none"} />
      <Txt variant="label" style={{ fontSize: 13, color: fg }}>
        {active ? action.on : action.label}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  pillButton: {
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toastWrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    maxWidth: 440,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingLeft: 20,
    paddingRight: 8,
    minHeight: 52,
  },
  undo: { height: 36, borderRadius: 999, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
});
