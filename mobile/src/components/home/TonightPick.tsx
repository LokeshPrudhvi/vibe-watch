import { useEffect } from "react";
import { Linking, StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clapperboard from "lucide-react-native/icons/clapperboard";
import Moon from "lucide-react-native/icons/moon";
import Play from "lucide-react-native/icons/play";
import Sparkles from "lucide-react-native/icons/sparkles";
import Star from "lucide-react-native/icons/star";
import Tv from "lucide-react-native/icons/tv";
import Wand2 from "lucide-react-native/icons/wand-sparkles";
import type { Recommendation } from "@shared/recommend";
import { toLite } from "@shared/taste";
import { addMinutes, formatClock, formatDuration } from "@shared/time";
import { availability, pickTrailer, yearOf, type Provider } from "@shared/tmdb";
import { FeedbackButtons, MatchRing } from "@/components/Feedback";
import { Poster, openTitle } from "@/components/Posters";
import { Card, Skeleton, Tap, Txt } from "@/components/ui";
import { useLiquidSurfaces, useSurface } from "@/components/Glass";
import { useAccent, useMovie } from "@/hooks/tmdb";
import { useNow } from "@/hooks/useUtils";
import { backdropUri, logoUri } from "@/lib/images";
import { useMotion } from "@/lib/motion";
import { useVibeStore } from "@/store/vibe";
import { alpha, mix } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export const openTrailer = (key: string) => Linking.openURL(`https://www.youtube.com/watch?v=${key}`);

export type NextAction = "skip" | "save";

/** card padding */
const PAD = 14;
/** gaps between the card's rows */
const GAP = 12;
/** height of the button rows and the match ring */
const ROW = 44;
/** the overview's two lines, reserved even when it's shorter so nothing below moves */
const OVERVIEW = 36;

/**
 * The poster sits beside the info: 38% of the card's inner width, 104–150dp. With the two button
 * rows that keeps the whole card around 360dp tall on a 360dp-wide phone, so Home fits one screen.
 */
function pickPosterWidth(width: number) {
  return Math.max(104, Math.min(150, Math.round((width - 32 - PAD * 2) * 0.38)));
}

/**
 * Tonight's pick, compact enough that mood, time and every action fit above the navbar:
 * poster + facts on top, a two-line overview, then Trailer / Next and one row of feedback icons
 * with the match ring. Themed by its poster; the ambient backdrop is a tiny image blurred once at
 * decode time, never a live blur.
 */
export function TonightPick({
  rec,
  loading,
  refreshing,
  onNext,
}: {
  rec?: Recommendation;
  loading: boolean;
  refreshing: boolean;
  /** move on: "skip" = not tonight (teaches the recommender), "save" = keep it in the Library */
  onNext: (action: NextAction) => void;
}) {
  if (loading) return <PickSkeleton />;
  if (!rec) return <EmptyPick />;
  // keyed per film: the swipe, fly-out and fade state start fresh for every pick
  return <PickCard key={rec.movie.id} rec={rec} refreshing={refreshing} onNext={onNext} />;
}

function PickCard({ rec, refreshing, onNext }: { rec: Recommendation; refreshing: boolean; onNext: (action: NextAction) => void }) {
  const { c, dark } = useTheme();
  const surface = useSurface();
  const liquid = useLiquidSurfaces();
  const signal = useVibeStore((s) => s.signal);
  const motion = useMotion();
  const { width } = useWindowDimensions();
  const movie = rec.movie;
  const details = useMovie(movie.id);
  const accent = useAccent(movie.poster_path);
  const now = useNow();

  // Fade + rise for each new pick. Not a layout "entering" animation: those sometimes never start
  // on Android's new architecture when the view mounts mid-layout, leaving the card invisible.
  // A timing on a shared value always lands on fully visible.
  const fadeMs = motion.duration(450);
  const shown = useSharedValue(fadeMs ? 0 : 1);
  useEffect(() => {
    shown.set(fadeMs ? withTiming(1, { duration: fadeMs }) : 1);
  }, [fadeMs, shown]);
  const enter = useAnimatedStyle(() => ({
    opacity: shown.get() * (refreshing ? 0.7 : 1),
    transform: [{ translateY: (1 - shown.get()) * 16 }],
  }));

  // the poster's swipe: left = next, right = save + next; the Next button flies it the same way
  const x = useSharedValue(0);
  const gone = useSharedValue(false);
  const flyMs = motion.duration(240);
  const fly = (action: NextAction) => {
    if (gone.get()) return;
    gone.set(true);
    Haptics.impactAsync(action === "save" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    if (!flyMs) return onNext(action);
    x.set(
      withTiming((action === "save" ? 1 : -1) * (width + 200), { duration: flyMs }, (finished) => {
        "worklet";
        if (finished) scheduleOnRN(onNext, action);
      }),
    );
  };

  const d = details.data;
  const trailer = pickTrailer(d?.videos);
  const { watch, rent } = availability(d);
  const lite = toLite(movie);
  const posterW = pickPosterWidth(width);
  const posterH = Math.round(posterW * 1.5);
  const open = () => {
    signal("open", lite);
    openTitle(movie.id, movie.poster_path);
  };

  return (
    <Animated.View
      style={[styles.card, liquid ? surface("card") : { backgroundColor: c.card, borderColor: alpha(c.tint, 0.05) }, enter]}
    >
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={backdropUri(movie.backdrop_path)}
          blurRadius={18}
          contentFit="cover"
          style={[StyleSheet.absoluteFill, { opacity: dark ? 0.45 : 0.3, transform: [{ scale: 1.15 }] }]}
        />
        <LinearGradient
          colors={[alpha(accent, 0.45), alpha(accent, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={liquid ? [alpha(c.card, 0), alpha(c.card, 0.45), alpha(c.card, 0.7)] : [alpha(c.card, 0), alpha(c.card, 0.6), c.card]}
          locations={[0, 0.45, 0.92]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={{ padding: PAD, gap: GAP }}>
        <View style={[styles.top, { minHeight: posterH }]}>
          <SwipePoster
            title={movie.title}
            path={movie.poster_path}
            id={movie.id}
            width={posterW}
            glow={alpha(accent, 0.7)}
            x={x}
            gone={gone}
            onFly={fly}
            onOpen={open}
          />
          <Tap scaleTo={0.98} onPress={open} accessibilityLabel={`Open ${movie.title}`} style={styles.info}>
            <View style={styles.inline}>
              <Sparkles size={12} color={mix(accent, c.ink, 0.6)} />
              <Txt variant="eyebrow" style={{ color: mix(accent, c.ink, 0.6), letterSpacing: 1.2 }}>
                Tonight&apos;s pick
              </Txt>
            </View>
            <Txt variant="title" numberOfLines={2} style={{ fontSize: 21, lineHeight: 25, marginTop: 4 }}>
              {movie.title}
            </Txt>
            <View style={[styles.inline, { marginTop: 4 }]}>
              <Txt variant="small" muted>
                {yearOf(movie.release_date)}
              </Txt>
              <Dot />
              <Star size={12} color={c.feel} fill={c.feel} />
              <Txt variant="small" muted>
                {movie.vote_average.toFixed(1)}
              </Txt>
              {d?.runtime ? <Dot /> : null}
              {d?.runtime ? (
                <Txt variant="small" muted numberOfLines={1}>
                  {formatDuration(d.runtime)}
                </Txt>
              ) : null}
            </View>
            {/* always one line tall, so the runtime arriving a moment later doesn't move anything */}
            <View style={[styles.inline, { marginTop: 2, height: 18 }]}>
              {d?.runtime ? (
                <>
                  <Moon size={12} color={c.time} />
                  <Txt variant="small" style={{ color: c.time, fontWeight: "600" }}>
                    Ends {formatClock(addMinutes(now, d.runtime))}
                  </Txt>
                </>
              ) : null}
            </View>
            <View style={[styles.inline, { marginTop: 6, alignItems: "flex-start" }]}>
              <Wand2 size={12} color={alpha(c.ink, 0.85)} style={{ marginTop: 3 }} />
              <Txt
                variant="small"
                numberOfLines={posterH >= 190 ? 2 : 1}
                style={{ flexShrink: 1, fontWeight: "600", color: alpha(c.ink, 0.85) }}
              >
                {rec.reason}
              </Txt>
            </View>
            <View style={{ marginTop: 6 }}>
              <AppsChip loading={details.isLoading} watch={watch} rentCount={rent.length} />
            </View>
          </Tap>
        </View>

        <Tap onPress={open} accessibilityLabel={`About ${movie.title}`} style={{ minHeight: OVERVIEW }}>
          <Txt variant="small" numberOfLines={2} style={{ color: alpha(c.ink, 0.75) }}>
            {movie.overview}
          </Txt>
        </Tap>

        <View style={styles.inlineRow}>
          <Tap
            disabled={!trailer}
            onPress={() => {
              if (!trailer) return;
              signal("trailer", lite); // interest signal for the recommender
              openTrailer(trailer.key);
            }}
            style={[styles.wide, { backgroundColor: accent, boxShadow: `0 10px 24px -12px ${accent}` }]}
          >
            <Play size={16} color={c.night} fill={c.night} />
            <Txt variant="label" style={{ color: c.night, fontWeight: "700" }}>
              Trailer
            </Txt>
          </Tap>
          <Tap
            accessibilityLabel="Next pick"
            onPress={() => fly("skip")} // nudges this title down for a few days → the next best fit moves up
            style={[styles.wide, surface("control")]}
          >
            <Txt variant="label">Next</Txt>
            <ChevronRight size={18} color={c.ink} strokeWidth={2.4} />
          </Tap>
        </View>

        <View style={styles.inlineRow}>
          <MatchRing value={rec.match} size={ROW} />
          <View style={{ flex: 1 }}>
            <FeedbackButtons movie={lite} compact />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

/** Where to watch, as one small chip: provider logos, or rent / not streaming. */
function AppsChip({ loading, watch, rentCount }: { loading: boolean; watch: Provider[]; rentCount: number }) {
  const { c } = useTheme();
  const surface = useSurface();
  if (loading) return <Skeleton style={{ height: 30, width: 104, borderRadius: 999 }} />;
  const label = watch.length
    ? `${watch.length} app${watch.length > 1 ? "s" : ""}`
    : rentCount
      ? `Rent on ${rentCount}`
      : "Not streaming";
  const Icon = rentCount ? Clapperboard : Tv;
  return (
    <View style={[styles.apps, surface("control")]}>
      {watch.length ? (
        <View style={{ flexDirection: "row" }}>
          {watch.slice(0, 3).map((p, i) => (
            <Image
              key={p.provider_id}
              source={logoUri(p.logo_path)}
              accessibilityLabel={p.provider_name}
              style={{ width: 22, height: 22, borderRadius: 11, marginLeft: i ? -6 : 0, borderWidth: 1.5, borderColor: c.card }}
            />
          ))}
        </View>
      ) : (
        <Icon size={14} color={c.ink} style={{ marginLeft: 6 }} />
      )}
      <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1, fontWeight: "600" }}>
        {label}
      </Txt>
    </View>
  );
}

function Dot() {
  const { c } = useTheme();
  return <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: alpha(c.muted, 0.6) }} />;
}

/** Same rows and sizes as the loaded card, so nothing moves when the pick arrives. */
function PickSkeleton() {
  const { width } = useWindowDimensions();
  const posterW = pickPosterWidth(width);
  const posterH = Math.round(posterW * 1.5);
  return (
    <Card style={{ padding: PAD, gap: GAP, marginHorizontal: 16, borderRadius: 28 }}>
      <View style={[styles.top, { minHeight: posterH }]}>
        <Skeleton style={{ width: posterW, height: posterH, borderRadius: 18 }} />
        <View style={[styles.info, { gap: 10 }]}>
          <Skeleton style={{ height: 12, width: 110, borderRadius: 999 }} />
          <Skeleton style={{ height: 22, width: "90%" }} />
          <Skeleton style={{ height: 14, width: "60%" }} />
          <Skeleton style={{ height: 14, width: "75%" }} />
        </View>
      </View>
      <Skeleton style={{ height: OVERVIEW, width: "100%" }} />
      <View style={styles.inlineRow}>
        <Skeleton style={{ height: ROW, flex: 1, borderRadius: 999 }} />
        <Skeleton style={{ height: ROW, flex: 1, borderRadius: 999 }} />
      </View>
      <Skeleton style={{ height: ROW, width: "100%", borderRadius: 16 }} />
    </Card>
  );
}

function EmptyPick() {
  return (
    <Card style={{ padding: 28, alignItems: "center", gap: 8, marginHorizontal: 16, borderRadius: 28 }}>
      <Txt variant="heading" style={{ fontSize: 22 }}>
        Nothing fits just yet
      </Txt>
      <Txt variant="small" muted style={{ textAlign: "center" }}>
        Give yourself a little more time, or try another vibe.
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: "absolute",
    top: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  stampLeft: { left: 8 },
  stampRight: { right: 8 },
  stampText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.8 },
  card: { marginHorizontal: 16, borderRadius: 28, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: "row", gap: 14 },
  info: { flex: 1, minWidth: 0 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  wide: { flex: 1, height: ROW, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  apps: { alignSelf: "flex-start", maxWidth: "100%", height: 30, borderRadius: 999, paddingLeft: 4, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 6 },
});

/**
 * The pick's poster, swipeable: left = next pick, right = save + next, tap = open. Only a
 * horizontal drag activates (activeOffsetX), and a vertical one fails it (failOffsetY), so
 * the page still scrolls. The Next button below does the same without a swipe.
 *
 * UI-thread callbacks only touch shared values and hand the rest to JS via scheduleOnRN:
 * calling plain JS functions from a worklet is what crashed the slider.
 */
function SwipePoster({
  title,
  path,
  id,
  width,
  glow,
  x,
  gone,
  onFly,
  onOpen,
}: {
  title: string;
  path: string | null;
  id: number;
  width: number;
  glow: string;
  x: SharedValue<number>;
  gone: SharedValue<boolean>;
  onFly: (action: NextAction) => void;
  onOpen: () => void;
}) {
  const { c } = useTheme();
  const motion = useMotion();
  const back = motion.spring({ stiffness: 420, damping: 32 });

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      "worklet";
      if (!gone.get()) x.set(e.translationX);
    },
    onDeactivate: (e) => {
      "worklet";
      if (gone.get()) return;
      if (e.translationX < -70 || e.velocityX < -600) scheduleOnRN(onFly, "skip");
      else if (e.translationX > 70 || e.velocityX > 600) scheduleOnRN(onFly, "save");
      else x.set(back ? withSpring(0, back) : 0);
    },
  });

  const card = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { rotate: `${(x.get() / 260) * 9}deg` }],
  }));
  const nextStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-90, -16], [1, 0], Extrapolation.CLAMP) }));
  const saveStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [16, 90], [0, 1], Extrapolation.CLAMP) }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ width, zIndex: 1 }, card]}>
        <Tap
          scaleTo={0.97}
          accessibilityLabel={`Open ${title}. Swipe left for the next pick, right to save it.`}
          onPress={onOpen}
          style={{ borderRadius: 18, boxShadow: `0 18px 36px -16px ${glow}` }}
        >
          <Poster path={path} width={width} radius={18} id={id} />
        </Tap>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampLeft, { borderColor: c.ink }, nextStamp]}>
          <Txt variant="label" style={styles.stampText}>
            NEXT
          </Txt>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampRight, { borderColor: c.match }, saveStamp]}>
          <Bookmark size={12} color={c.match} fill={c.match} />
          <Txt variant="label" style={[styles.stampText, { color: c.match }]}>
            SAVE
          </Txt>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
