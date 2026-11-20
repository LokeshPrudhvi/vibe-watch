import { Linking, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Clapperboard from "lucide-react-native/icons/clapperboard";
import Moon from "lucide-react-native/icons/moon";
import Play from "lucide-react-native/icons/play";
import Shuffle from "lucide-react-native/icons/shuffle";
import Sparkles from "lucide-react-native/icons/sparkles";
import Star from "lucide-react-native/icons/star";
import Tv from "lucide-react-native/icons/tv";
import Wand2 from "lucide-react-native/icons/wand-sparkles";
import { GENRES } from "@shared/moods";
import type { Recommendation } from "@shared/recommend";
import { toLite } from "@shared/taste";
import { addMinutes, formatClock, formatDuration } from "@shared/time";
import { availability, pickTrailer, yearOf, type Provider } from "@shared/tmdb";
import { FeedbackButtons, MatchRing } from "@/components/Feedback";
import { Poster, openTitle } from "@/components/Posters";
import { Card, Chip, Skeleton, Tap, Txt } from "@/components/ui";
import { useAccent, useMovie } from "@/hooks/tmdb";
import { useNow } from "@/hooks/useUtils";
import { backdropUri, logoUri } from "@/lib/images";
import { useMotion } from "@/lib/motion";
import { useVibeStore } from "@/store/vibe";
import { alpha, mix } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export const openTrailer = (key: string) => Linking.openURL(`https://www.youtube.com/watch?v=${key}`);

/**
 * Tonight's pick, themed by its poster. The ambient backdrop is a tiny w300 image blurred once
 * at decode time, never a live blur, so it costs nothing while scrolling.
 */
export function TonightPick({ rec, loading, refreshing }: { rec?: Recommendation; loading: boolean; refreshing: boolean }) {
  const { c, dark } = useTheme();
  const signal = useVibeStore((s) => s.signal);
  const motion = useMotion();
  const { width } = useWindowDimensions();
  const movie = rec?.movie;
  const details = useMovie(movie?.id);
  const accent = useAccent(movie?.poster_path);
  const now = useNow();

  if (loading) return <PickSkeleton />;
  if (!rec || !movie) return <EmptyPick />;

  const d = details.data;
  const trailer = pickTrailer(d?.videos);
  const { watch, rent } = availability(d);
  const lite = toLite(movie);
  const posterW = Math.min(260, Math.round((width - 32) * 0.62));

  return (
    <Animated.View
      key={movie.id}
      entering={motion.off ? undefined : FadeInDown.duration(motion.duration(450))}
      style={[styles.card, { backgroundColor: c.card, borderColor: alpha(c.tint, 0.05), opacity: refreshing ? 0.7 : 1 }]}
    >
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
        colors={[alpha(c.card, 0), alpha(c.card, 0.6), c.card]}
        locations={[0, 0.45, 0.92]}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ padding: 16, gap: 18 }}>
        <Tap
          scaleTo={0.97}
          accessibilityLabel={`Open ${movie.title}`}
          onPress={() => {
            signal("open", lite);
            openTitle(movie.id, movie.poster_path);
          }}
          style={{ alignSelf: "center", borderRadius: 24, boxShadow: `0 30px 60px -22px ${alpha(accent, 0.75)}` }}
        >
          <Poster path={movie.poster_path} width={posterW} radius={24} id={movie.id} />
        </Tap>

        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={[styles.badge, { backgroundColor: alpha(accent, 0.22) }]}>
              <Sparkles size={14} color={mix(accent, c.ink, 0.6)} />
              <Txt variant="eyebrow" style={{ color: mix(accent, c.ink, 0.6), letterSpacing: 1.4 }}>
                Tonight&apos;s pick
              </Txt>
            </View>
            {d?.runtime ? (
              <View style={[styles.badge, { backgroundColor: alpha(c.tint, 0.08) }]}>
                <Moon size={14} color={c.time} />
                <Txt variant="caption" style={{ fontWeight: "600" }}>
                  Ends {formatClock(addMinutes(now, d.runtime))}
                </Txt>
              </View>
            ) : null}
          </View>

          <View style={{ gap: 6 }}>
            <Txt variant="title" style={{ fontSize: 30, lineHeight: 34 }}>
              {movie.title}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Wand2 size={14} color={alpha(c.ink, 0.85)} />
              <Txt variant="label" style={{ fontSize: 13, color: alpha(c.ink, 0.85), flexShrink: 1 }}>
                {rec.reason}
              </Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Txt variant="small" muted>
                {yearOf(movie.release_date)}
              </Txt>
              {d?.runtime ? <Dot /> : null}
              {d?.runtime ? (
                <Txt variant="small" muted>
                  {formatDuration(d.runtime)}
                </Txt>
              ) : null}
              <Dot />
              <Star size={14} color={c.feel} fill={c.feel} />
              <Txt variant="small" muted>
                {movie.vote_average.toFixed(1)}
              </Txt>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {movie.genre_ids.slice(0, 3).map((g) => (
              <Chip key={g} label={GENRES[g] ?? "Other"} />
            ))}
          </View>

          <Txt variant="small" numberOfLines={3} style={{ color: alpha(c.ink, 0.75), lineHeight: 20 }}>
            {movie.overview}
          </Txt>

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <MatchRing value={rec.match} />
            <Tap
              disabled={!trailer}
              onPress={() => {
                if (!trailer) return;
                signal("trailer", lite); // interest signal for the recommender
                openTrailer(trailer.key);
              }}
              style={[styles.trailer, { backgroundColor: accent, boxShadow: `0 10px 28px -10px ${accent}` }]}
            >
              <Play size={16} color={c.night} fill={c.night} />
              <Txt variant="label" style={{ color: c.night, fontWeight: "700" }}>
                Trailer
              </Txt>
            </Tap>
            <AppsPill loading={details.isLoading} watch={watch} rentCount={rent.length} />
            <Tap
              scaleTo={0.88}
              accessibilityLabel="Pick something else"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                signal("skip", lite); // nudges this title down for a few days → the next best fit moves up
              }}
              style={[styles.round, { backgroundColor: alpha(c.tint, 0.08) }]}
            >
              <Shuffle size={16} color={c.ink} />
            </Tap>
          </View>
          <FeedbackButtons movie={lite} />
        </View>
      </View>
    </Animated.View>
  );
}

function AppsPill({ loading, watch, rentCount }: { loading: boolean; watch: Provider[]; rentCount: number }) {
  const { c } = useTheme();
  if (loading) return <Skeleton style={{ height: 44, width: 128, borderRadius: 999 }} />;
  const label = watch.length
    ? `On ${watch.length} app${watch.length > 1 ? "s" : ""}`
    : rentCount
      ? `Rent on ${rentCount}`
      : "Not streaming in India";
  const Icon = rentCount ? Clapperboard : Tv;
  return (
    <View style={[styles.apps, { backgroundColor: alpha(c.tint, 0.08) }]}>
      {watch.length ? (
        <View style={{ flexDirection: "row" }}>
          {watch.slice(0, 3).map((p, i) => (
            <Image
              key={p.provider_id}
              source={logoUri(p.logo_path)}
              accessibilityLabel={p.provider_name}
              style={{ width: 32, height: 32, borderRadius: 16, marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: c.card }}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.round, { width: 32, height: 32, backgroundColor: alpha(c.tint, 0.1) }]}>
          <Icon size={16} color={c.ink} />
        </View>
      )}
      <Txt variant="label">{label}</Txt>
    </View>
  );
}

function Dot() {
  const { c } = useTheme();
  return <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: alpha(c.muted, 0.6) }} />;
}

function PickSkeleton() {
  const { width } = useWindowDimensions();
  const posterW = Math.min(260, Math.round((width - 32) * 0.62));
  return (
    <Card style={{ padding: 16, gap: 14, marginHorizontal: 16, borderRadius: 32 }}>
      <Skeleton style={{ width: posterW, aspectRatio: 2 / 3, borderRadius: 24, alignSelf: "center" }} />
      <Skeleton style={{ height: 24, width: 150, borderRadius: 999 }} />
      <Skeleton style={{ height: 36, width: "75%" }} />
      <Skeleton style={{ height: 16, width: "50%" }} />
      <Skeleton style={{ height: 60, width: "100%" }} />
    </Card>
  );
}

function EmptyPick() {
  return (
    <Card style={{ padding: 28, alignItems: "center", gap: 8, marginHorizontal: 16, borderRadius: 32 }}>
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
  card: { marginHorizontal: 16, borderRadius: 32, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  trailer: { height: 48, borderRadius: 999, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8 },
  apps: { height: 44, borderRadius: 999, paddingLeft: 6, paddingRight: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
