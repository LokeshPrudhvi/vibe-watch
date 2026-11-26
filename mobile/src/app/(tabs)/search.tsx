import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { SEARCH_LANGUAGES, languageFromQuery, languageLabel } from "@shared/languages";
import type { MovieSummary } from "@shared/tmdb";
import { ErrorCard } from "@/components/Feedback";
import { useNavSpace } from "@/components/FloatingNav";
import { useSurface } from "@/components/Glass";
import { GlassPage } from "@/components/GlassPage";
import { LargeTitle, TopBar, useHeaderScroll, useHeaderSpace } from "@/components/Header";
import { GridSkeleton, PosterCard, PosterGrid } from "@/components/Posters";
import { Empty, SectionTitle, Tap, Txt } from "@/components/ui";
import { useLanguageBrowse, useSearch as useSearchResults, useTrending } from "@/hooks/tmdb";
import { useDebounced } from "@/hooks/useUtils";
import { useSearch } from "@/store/ui";
import { useTheme } from "@/theme/useTheme";

type Row = { kind: "title"; key: string; title: string; note?: string } | { kind: "movie"; key: string; movie: MovieSummary; lang: boolean };

/**
 * Results for the search field in the navbar, optionally limited to an original language.
 * A language with no text browses that language. Section titles are grid rows spanning all columns.
 */
export default function SearchScreen() {
  const rawQuery = useSearch((s) => s.query);
  const setQuery = useSearch((s) => s.setQuery);
  const lang = useSearch((s) => s.lang);
  const setLang = useSearch((s) => s.setLang);
  const q = useDebounced(rawQuery, 300);
  const label = lang ? languageLabel(lang) : undefined;
  const header = useHeaderScroll();
  const top = useHeaderSpace();
  const navSpace = useNavSpace();

  // Typed just a language ("tamil", "bollywood movies") → switch to browsing it.
  const typedLanguage = languageFromQuery(q);
  useEffect(() => {
    if (!typedLanguage) return;
    setLang(typedLanguage);
    setQuery("");
  }, [typedLanguage, setLang, setQuery]);

  const active = q.trim().length >= 2 && !typedLanguage;
  const search = useSearchResults(active ? q : "", lang);
  const browse = useLanguageBrowse(active ? undefined : lang);
  const trending = useTrending();

  const title = active ? "Results" : label ? `Made in ${label}` : "Search";
  const eyebrow = active
    ? `for “${q.trim()}”${label ? ` · ${label} first` : ""}`
    : label
      ? "Popular in India · ranked for you"
      : "Type in the bar below";

  const movies = (list: MovieSummary[], showLang: boolean): Row[] =>
    list.map((m) => ({ kind: "movie", key: `m-${m.id}`, movie: m, lang: showLang }));

  let rows: Row[] = [];
  let status: React.ReactNode = null;
  if (active) {
    if (search.isError) status = <ErrorCard error={search.error} onRetry={search.refetch} />;
    else if (search.isLoading) status = <GridSkeleton />;
    else if (!search.primary.length && !search.others.length)
      status = <Empty text={`Nothing matched “${q.trim()}”. Try a different spelling or a shorter title.`} />;
    else {
      if (search.primary.length) {
        if (label) rows.push({ kind: "title", key: "t-primary", title: `Made in ${label}` });
        rows = rows.concat(movies(search.primary, !label));
      }
      if (search.others.length) {
        rows.push({
          kind: "title",
          key: "t-others",
          title: "From other languages · often dubbed",
          note: search.primary.length
            ? `Our data only knows each film's original language, so ${label} dubs aren't listed. Check the audio options in the streaming app.`
            : `No ${label} originals matched “${q.trim()}”. These were made in other languages and may have ${label} dubs; check the audio options in the streaming app.`,
        });
        rows = rows.concat(movies(search.others, true));
      }
    }
  } else if (lang) {
    if (browse.isError) status = <ErrorCard error={browse.error} onRetry={browse.refetch} />;
    else if (browse.isLoading) status = <GridSkeleton />;
    else if (!browse.recs.length) status = <Empty text={`Nothing in ${label} is streaming or rentable in India right now.`} />;
    else rows = movies(browse.recs.map((r) => r.movie), false);
  } else {
    rows = [{ kind: "title", key: "t-trending", title: "Trending now" }, ...movies(trending.data?.slice(0, 18) ?? [], false)];
    if (trending.isLoading) status = <GridSkeleton />;
  }

  const head = (
    <View style={{ gap: 16, paddingBottom: 16, marginHorizontal: -10 }}>
      <LargeTitle title={title} eyebrow={eyebrow} />
      <View style={{ gap: 8 }}>
        <Txt variant="eyebrow" muted style={{ paddingHorizontal: 16 }}>
          Original language
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <LangChip label="Any language" on={!lang} onPress={() => setLang(undefined)} />
          {SEARCH_LANGUAGES.map((l) => (
            <LangChip key={l.code} label={l.label} on={lang === l.code} onPress={() => setLang(l.code)} />
          ))}
        </ScrollView>
      </View>
      {status && <View style={{ paddingHorizontal: 16 }}>{status}</View>}
    </View>
  );

  return (
    <GlassPage
      bar={<TopBar title={title} scrolled={header.scrolled} collapsed={header.collapsed} />}
    >
      <View style={{ flex: 1, opacity: search.isPlaceholderData && active ? 0.6 : 1 }}>
        <PosterGrid<Row>
          data={status ? [] : rows}
          keyOf={(r) => r.key}
          header={head}
          onScroll={header.onScroll}
          paddingTop={top}
          paddingBottom={navSpace}
          renderCell={(r, cell) =>
            r.kind === "title" ? (
              <View style={{ paddingTop: 4 }}>
                <SectionTitle title={r.title} subtitle={r.note} />
              </View>
            ) : (
              <PosterCard movie={r.movie} width={cell} showLanguage={r.lang} />
            )
          }
          spanOf={(r) => (r.kind === "title" ? "full" : 1)}
        />
      </View>
    </GlassPage>
  );
}

function LangChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const surface = useSurface();
  return (
    <Tap
      onPress={onPress}
      accessibilityState={{ selected: on }}
      style={[{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }, on ? { backgroundColor: c.ink, borderWidth: 1, borderColor: c.ink } : surface("tile")]}
    >
      <Txt variant="label" style={{ color: on ? c.inverse : c.ink }}>
        {label}
      </Txt>
    </Tap>
  );
}
