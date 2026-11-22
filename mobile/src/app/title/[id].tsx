import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import Clapperboard from "lucide-react-native/icons/clapperboard";
import EyeOff from "lucide-react-native/icons/eye-off";
import Moon from "lucide-react-native/icons/moon";
import Play from "lucide-react-native/icons/play";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Star from "lucide-react-native/icons/star";
import Tv from "lucide-react-native/icons/tv";
import Wand2 from "lucide-react-native/icons/wand-sparkles";
import { INDIAN_LANGUAGES, languageLabel } from "@shared/languages";
import { toLite } from "@shared/taste";
import { addMinutes, formatClock, formatDuration } from "@shared/time";
import {
  ApiError,
  certification,
  isReleased,
  pickTrailer,
  providerGroups,
  releaseLabel,
  tmdbImage,
  todayISO,
  yearOf,
  type MovieDetails,
  type Provider,
} from "@shared/tmdb";
import { ErrorCard, FeedbackButtons, MatchRing } from "@/components/Feedback";
import { TopBar, useHeaderScroll } from "@/components/Header";
import { Poster, PosterRow } from "@/components/Posters";
import { Card, Chip, Empty, SectionTitle, Skeleton, Tap, Txt } from "@/components/ui";
import { openTrailer } from "@/components/home/TonightPick";
import { isValidId, useAccent, useMatchFor, useMoreLikeThis, useMovieFull } from "@/hooks/tmdb";
import { useNow } from "@/hooks/useUtils";
import { backdropUri, logoUri } from "@/lib/images";
import { useMotion } from "@/lib/motion";
import { useVibeStore } from "@/store/vibe";
import { alpha, mix } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/** Compact vote counts ("12.3K"); Intl's compact notation isn't available on every Hermes build. */
function compact(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export default function TitleScreen() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const { height, width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; poster?: string }>();
  const movieId = Number(params.id);
  const valid = isValidId(movieId);
  const { data, error, isError, isLoading, refetch } = useMovieFull(valid ? movieId : undefined);
  const notFound = !valid || (error instanceof ApiError && error.status === 404);
  const poster = params.poster || data?.poster_path || null;
  const accent = useAccent(poster);
  const hero = Math.round(height * 0.58);
  const posterW = Math.min(260, Math.round(width * 0.56));
  // bar turns solid once the poster is half gone; the small title appears when the big one passes under it
  const header = useHeaderScroll(posterW * 1.5 + 40, posterW * 0.75);

  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: c.base, paddingTop: insets.top + 72, paddingHorizontal: 16 }}>
        <Empty text="We couldn't find that movie. It may have been removed from TMDB." />
        <TopBar title="Title not found" scrolled={false} collapsed={false} back settings={false} />
      </View>
    );
  }

  const released = data ? isReleased(data.release_date, data.status) : true;
  const trailer = pickTrailer(data?.videos);

  return (
    <View style={{ flex: 1, backgroundColor: c.base }}>
      <ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {/* cinematic backdrop fading into the page */}
        <View style={[styles.hero, { height: hero }]} pointerEvents="none">
          {data?.backdrop_path && (
            <Image
              source={backdropUri(data.backdrop_path, true)}
              contentFit="cover"
              transition={motion.off ? null : 300}
              style={[StyleSheet.absoluteFill, { opacity: dark ? 0.6 : 0.45 }]}
            />
          )}
          <LinearGradient colors={[alpha(accent, 0.3), alpha(accent, 0)]} end={{ x: 0.7, y: 0.6 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[alpha(c.base, 0.25), alpha(c.base, 0.8), c.base]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={{ paddingTop: insets.top + 64, paddingHorizontal: 16, gap: 32 }}>
          {isError && <ErrorCard error={error} onRetry={() => refetch()} />}

          <View style={{ alignItems: "center", gap: 22 }}>
            {poster ? (
              <View style={{ borderRadius: 28, boxShadow: `0 30px 60px -22px ${alpha(accent, 0.75)}` }}>
                <Poster path={poster} width={posterW} radius={28} id={movieId} />
              </View>
            ) : (
              isLoading && <Skeleton style={{ width: posterW, aspectRatio: 2 / 3, borderRadius: 28 }} />
            )}
            {data ? (
              <Animated.View entering={motion.off ? undefined : FadeInDown.delay(120).duration(motion.duration(380))} style={{ alignItems: "center" }}>
                <Hero data={data} released={released} accent={accent} />
              </Animated.View>
            ) : (
              isLoading && (
                <View style={{ alignItems: "center", gap: 10 }}>
                  <Skeleton style={{ height: 36, width: 240 }} />
                  <Skeleton style={{ height: 16, width: 150 }} />
                </View>
              )
            )}
          </View>

          {data && (
            <Animated.View entering={motion.off ? undefined : FadeIn.delay(200)} style={{ gap: 36 }}>
              <Actions data={data} trailerKey={trailer?.key} accent={accent} />
              <ScoreTiles data={data} released={released} />
              <WhereToWatch data={data} released={released} />
              {data.overview ? (
                <Section title="Story">
                  <Txt style={{ color: alpha(c.ink, 0.85) }}>{data.overview}</Txt>
                </Section>
              ) : null}
              <Themes data={data} />
              <Cast data={data} />
              <MoreLikeThis id={data.id} />
              <Txt variant="caption" muted style={{ lineHeight: 16 }}>
                Data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
                Streaming availability by JustWatch.
              </Txt>
            </Animated.View>
          )}
        </View>
      </ScrollView>
      <TopBar title={data?.title ?? ""} scrolled={header.scrolled} collapsed={header.collapsed} back settings={false} />
    </View>
  );
}

/* ---------- pieces ---------- */

function Hero({ data, released, accent }: { data: MovieDetails; released: boolean; accent: string }) {
  const { c } = useTheme();
  const rating = certification(data);
  const meta = [yearOf(data.release_date), data.runtime ? formatDuration(data.runtime) : "", data.original_language ? languageLabel(data.original_language) : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      {!released && (
        <View style={[styles.badge, { backgroundColor: alpha(accent, 0.22) }]}>
          <CalendarClock size={14} color={mix(accent, c.ink, 0.6)} />
          <Txt variant="eyebrow" style={{ color: mix(accent, c.ink, 0.6) }}>
            Coming {releaseLabel(data.release_date)}
          </Txt>
        </View>
      )}
      <Txt variant="hero" style={{ textAlign: "center" }}>
        {data.title}
      </Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt variant="small" muted>
          {meta}
        </Txt>
        {rating && (
          <View style={{ borderRadius: 6, borderWidth: 1, borderColor: alpha(c.tint, 0.25), paddingHorizontal: 6, paddingVertical: 1 }}>
            <Txt variant="caption" style={{ fontWeight: "700" }}>
              {rating.cert}
            </Txt>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
        {data.genres.slice(0, 4).map((g) => (
          <Chip key={g.id} label={g.name} />
        ))}
      </View>
      {data.tagline ? (
        <Txt style={{ fontStyle: "italic", fontWeight: "600", textAlign: "center", color: mix(accent, c.ink, 0.65) }}>{data.tagline}</Txt>
      ) : null}
    </View>
  );
}

function Actions({ data, trailerKey, accent }: { data: MovieDetails; trailerKey?: string; accent: string }) {
  const { c } = useTheme();
  const match = useMatchFor(data);
  const signal = useVibeStore((s) => s.signal);
  const lite = toLite(data);
  return (
    <View style={{ alignItems: "center", gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {match && <MatchRing value={match.match} />}
        <Tap
          disabled={!trailerKey}
          onPress={() => {
            if (!trailerKey) return;
            signal("trailer", lite);
            openTrailer(trailerKey);
          }}
          style={{
            height: 48,
            borderRadius: 999,
            paddingHorizontal: 24,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: accent,
            boxShadow: `0 10px 28px -10px ${accent}`,
          }}
        >
          <Play size={16} color={c.night} fill={c.night} />
          <Txt variant="label" style={{ color: c.night, fontWeight: "700" }}>
            {trailerKey ? "Trailer" : "No trailer yet"}
          </Txt>
        </Tap>
      </View>
      {match && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Wand2 size={14} color={alpha(c.ink, 0.85)} />
          <Txt variant="label" style={{ fontSize: 13, color: alpha(c.ink, 0.85) }}>
            {match.reason}
          </Txt>
        </View>
      )}
      <View style={{ alignItems: "center" }}>
        <FeedbackButtons movie={lite} />
      </View>
    </View>
  );
}

function Tile({ Icon, label, value, sub }: { Icon: typeof Star; label: string; value: string; sub?: string }) {
  const { c } = useTheme();
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, padding: 16, borderRadius: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon size={14} color={c.muted} />
        <Txt variant="eyebrow" muted style={{ letterSpacing: 1.2 }}>
          {label}
        </Txt>
      </View>
      <Txt variant="heading" numberOfLines={1} style={{ fontSize: 24, lineHeight: 30, marginTop: 8 }}>
        {value}
      </Txt>
      {sub ? (
        <Txt variant="caption" muted numberOfLines={1} style={{ fontSize: 12 }}>
          {sub}
        </Txt>
      ) : null}
    </Card>
  );
}

function ScoreTiles({ data, released }: { data: MovieDetails; released: boolean }) {
  const now = useNow();
  const match = useMatchFor(data);
  const rating = certification(data);
  const enoughVotes = data.vote_count >= 10;
  const daysToGo = data.release_date
    ? Math.max(0, Math.round((Date.parse(data.release_date) - Date.parse(todayISO(now))) / 86_400_000))
    : undefined;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      <Tile
        Icon={Star}
        label="TMDB"
        value={enoughVotes ? `${data.vote_average.toFixed(1)}★` : "—"}
        sub={enoughVotes ? `${compact(data.vote_count)} votes` : "Not enough votes yet"}
      />
      <Tile Icon={Wand2} label="Your match" value={match ? `${match.match}%` : "—"} sub={match?.reason} />
      {released ? (
        <Tile
          Icon={Moon}
          label="Done by"
          value={data.runtime ? formatClock(addMinutes(now, data.runtime)) : "—"}
          sub={data.runtime ? `If you start now · ${formatDuration(data.runtime)}` : "Runtime unknown"}
        />
      ) : (
        <Tile
          Icon={CalendarClock}
          label="Release"
          value={releaseLabel(data.release_date)}
          sub={daysToGo !== undefined ? `In ${daysToGo} day${daysToGo === 1 ? "" : "s"}` : data.status}
        />
      )}
      <Tile
        Icon={ShieldCheck}
        label="Rated"
        value={rating?.cert ?? "—"}
        sub={rating ? (rating.region === "IN" ? "India (CBFC)" : "US rating") : "Not rated yet"}
      />
    </View>
  );
}

function ProviderList({ title, Icon, list }: { title: string; Icon: typeof Tv; list: Provider[] }) {
  const { c } = useTheme();
  if (!list.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon size={14} color={c.muted} />
        <Txt variant="caption" muted style={{ fontSize: 12, fontWeight: "600" }}>
          {title}
        </Txt>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {list.map((p) => (
          <View
            key={p.provider_id}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: alpha(c.tint, 0.06), padding: 4, paddingRight: 14 }}
          >
            <Image source={logoUri(p.logo_path)} style={{ width: 32, height: 32, borderRadius: 16 }} />
            <Txt variant="label">{p.provider_name}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function WhereToWatch({ data, released }: { data: MovieDetails; released: boolean }) {
  const { stream, rent, buy, link } = providerGroups(data);
  const none = !stream.length && !rent.length && !buy.length;
  return (
    <Section title="Where to watch in India">
      <Card style={{ padding: 20, gap: 16, borderRadius: 24 }}>
        {none ? (
          <Txt variant="small" muted>
            {released ? "Not streaming, rentable or for sale in India right now." : "Not out yet. Save it and it'll be waiting in your Library."}
          </Txt>
        ) : (
          <>
            <ProviderList title="Stream" Icon={Tv} list={stream} />
            <ProviderList title="Rent" Icon={Clapperboard} list={rent} />
            <ProviderList title="Buy" Icon={Clapperboard} list={buy} />
          </>
        )}
        {!none && data.original_language && INDIAN_LANGUAGES.has(data.original_language) && (
          <Txt variant="caption" muted style={{ fontSize: 12, lineHeight: 17 }}>
            Made in {languageLabel(data.original_language)}. Indian releases often stream with dubbed audio too (Hindi,
            Tamil, Telugu, Malayalam…). Our data doesn&apos;t list audio languages, so check the audio options in the app.
          </Txt>
        )}
        {link && !none && (
          <Tap onPress={() => WebBrowser.openBrowserAsync(link)} scaleTo={0.98} style={{ alignSelf: "flex-start" }}>
            <Txt variant="caption" muted style={{ fontSize: 12, fontWeight: "600", textDecorationLine: "underline" }}>
              Prices and links on TMDB · availability by JustWatch
            </Txt>
          </Tap>
        )}
      </Card>
    </Section>
  );
}

/** Keywords often give the plot away ("twist ending", "death of …"), so they start hidden. */
function Themes({ data }: { data: MovieDetails }) {
  const { c } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const words = data.keywords?.keywords.slice(0, 14) ?? [];
  if (!words.length) return null;
  return (
    <Section title="Themes">
      <View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityElementsHidden={!revealed}>
          {words.map((k) => (
            <View key={k.id} style={{ borderRadius: 999, backgroundColor: alpha(c.tint, 0.08), paddingHorizontal: 12, paddingVertical: 5 }}>
              {revealed ? (
                <Txt variant="caption" style={{ fontSize: 12, fontWeight: "500", textTransform: "capitalize" }}>
                  {k.name}
                </Txt>
              ) : (
                // redacted bar the width of the word: no live blur needed
                <View style={{ height: 12, marginVertical: 2, width: Math.min(140, 7 * k.name.length), borderRadius: 6, backgroundColor: alpha(c.tint, 0.12) }} />
              )}
            </View>
          ))}
        </View>
        {!revealed && (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
            <Tap
              onPress={() => setRevealed(true)}
              style={{
                height: 44,
                borderRadius: 999,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: alpha(c.card2, 0.96),
                borderWidth: 1,
                borderColor: alpha(c.tint, 0.1),
                boxShadow: `0 10px 24px -10px ${c.shadow}`,
              }}
            >
              <EyeOff size={16} color={c.ink} />
              <Txt variant="label">Spoiler shield · tap to show</Txt>
            </Tap>
          </View>
        )}
      </View>
    </Section>
  );
}

function Cast({ data }: { data: MovieDetails }) {
  const { c } = useTheme();
  const cast = (data.credits?.cast ?? []).slice().sort((a, b) => a.order - b.order).slice(0, 15);
  const directors = (data.credits?.crew ?? []).filter((m) => m.job === "Director").map((m) => m.name);
  if (!cast.length && !directors.length) return null;
  return (
    <Section title="Cast & crew" subtitle={directors.length ? `Directed by ${directors.join(", ")}` : undefined} bleed>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {cast.map((p) => (
          <View key={p.id} style={{ width: 88 }}>
            {p.profile_path ? (
              <Image
                source={tmdbImage(p.profile_path, "w185")}
                recyclingKey={String(p.id)}
                style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.card }}
              />
            ) : (
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}>
                <Txt variant="heading" muted style={{ fontSize: 26, lineHeight: 30 }}>
                  {p.name[0]}
                </Txt>
              </View>
            )}
            <Txt variant="caption" numberOfLines={1} style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: "600" }}>
              {p.name}
            </Txt>
            <Txt variant="caption" muted numberOfLines={1} style={{ textAlign: "center" }}>
              {p.character}
            </Txt>
          </View>
        ))}
      </ScrollView>
    </Section>
  );
}

function MoreLikeThis({ id }: { id: number }) {
  const { recs, isLoading, isError } = useMoreLikeThis(id);
  if (isError || (!isLoading && !recs.length)) return null;
  return (
    <View style={{ marginHorizontal: -16 }}>
      <PosterRow title="More like this" subtitle="Ranked for your taste" loading={isLoading} movies={recs.map((r) => r.movie)} />
    </View>
  );
}

function Section({ title, subtitle, children, bleed }: { title: string; subtitle?: string; children: ReactNode; bleed?: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title={title} subtitle={subtitle} />
      <View style={bleed ? { marginHorizontal: -16 } : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { position: "absolute", top: 0, left: 0, right: 0 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
});
