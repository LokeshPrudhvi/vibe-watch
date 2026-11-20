/** Poster card, horizontal poster row and the 3-column poster grid (all recycled by FlashList). */
import type { ReactElement, ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import type { MovieSummary } from "@shared/tmdb";
import { isReleased, releaseLabel } from "@shared/tmdb";
import { languageLabel } from "@shared/languages";
import { toLite } from "@shared/taste";
import { SectionTitle, Skeleton, Tap, Txt } from "@/components/ui";
import { posterUri } from "@/lib/images";
import { useMotion } from "@/lib/motion";
import { useVibeStore } from "@/store/vibe";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/** Opens the detail screen; the poster path lets it show the poster before the details load. */
export function openTitle(id: number, poster?: string | null) {
  router.push({ pathname: "/title/[id]", params: { id: String(id), poster: poster ?? "" } });
}

export function Poster({ path, width, radius = 16, id }: { path: string | null; width: number; radius?: number; id?: number }) {
  const { c } = useTheme();
  const motion = useMotion();
  return (
    <Image
      source={posterUri(path, width)}
      recyclingKey={id ? String(id) : path}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={motion.off ? null : motion.duration(160)}
      accessibilityIgnoresInvertColors
      style={{
        width,
        aspectRatio: 2 / 3,
        borderRadius: radius,
        backgroundColor: c.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: alpha(c.tint, 0.06),
      }}
    />
  );
}

export function PosterCard({
  movie,
  width,
  showLanguage,
  footer,
}: {
  movie: MovieSummary;
  width: number;
  showLanguage?: boolean;
  footer?: ReactNode;
}) {
  const signal = useVibeStore((s) => s.signal);
  const meta = [
    showLanguage && movie.original_language ? languageLabel(movie.original_language) : undefined,
    isReleased(movie.release_date) ? undefined : `Coming ${releaseLabel(movie.release_date)}`,
  ].filter(Boolean);

  return (
    <Tap
      scaleTo={0.96}
      accessibilityLabel={movie.title}
      onPress={() => {
        signal("open", toLite(movie));
        openTitle(movie.id, movie.poster_path);
      }}
      style={{ width }}
    >
      <Poster path={movie.poster_path} width={width} id={movie.id} />
      <Txt variant="label" numberOfLines={1} style={{ marginTop: 8 }}>
        {movie.title}
      </Txt>
      {footer ??
        (meta.length ? (
          <Txt variant="caption" muted numberOfLines={1} style={{ fontWeight: "500" }}>
            {meta.join(" · ")}
          </Txt>
        ) : null)}
    </Tap>
  );
}

const ROW_CARD = 128;
const ROW_HEIGHT = ROW_CARD * 1.5 + 8 + 18 + 16;

export function PosterRow({
  title,
  subtitle,
  movies,
  loading,
}: {
  title: string;
  subtitle?: string;
  movies?: MovieSummary[];
  loading?: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionTitle title={title} subtitle={subtitle} />
      </View>
      {loading ? (
        <ScrollView horizontal scrollEnabled={false} contentContainerStyle={styles.rowContent} style={{ height: ROW_HEIGHT }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} style={{ width: ROW_CARD, aspectRatio: 2 / 3, marginRight: 12 }} />
          ))}
        </ScrollView>
      ) : (
        <FlashList
          horizontal
          data={movies ?? []}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => <PosterCard movie={item} width={ROW_CARD} />}
          ItemSeparatorComponent={RowGap}
          contentContainerStyle={styles.rowContent}
          showsHorizontalScrollIndicator={false}
          style={{ height: ROW_HEIGHT }}
        />
      )}
    </View>
  );
}

const RowGap = () => <View style={{ width: 12 }} />;

/** Width of one cell in the 3-column grid. */
export function useGridCell() {
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 4 : 3;
  return { columns, cell: Math.floor((width - 32 - 12 * (columns - 1)) / columns) };
}

/**
 * Full-screen poster grid: the page's own scroll view, so `header` scrolls with it.
 * Each cell is padded by 6 so the visible gap is 12, with 16 at the screen edges.
 */
export function PosterGrid<T>({
  data,
  keyOf,
  renderCell,
  header,
  footer,
  onScroll,
  paddingTop,
  paddingBottom,
  spanOf,
}: {
  data: T[];
  keyOf: (item: T) => string;
  renderCell: (item: T, cell: number) => ReactElement;
  header: ReactElement;
  footer?: ReactElement;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  paddingTop: number;
  paddingBottom: number;
  /** "full" for rows that span every column (section titles) */
  spanOf?: (item: T) => "full" | 1;
}) {
  const { columns, cell } = useGridCell();
  return (
    <FlashList
      data={data}
      numColumns={columns}
      keyExtractor={keyOf}
      renderItem={({ item }) => <View style={{ paddingHorizontal: 6, paddingBottom: 16 }}>{renderCell(item, cell)}</View>}
      getItemType={(item) => spanOf?.(item) ?? 1}
      overrideItemLayout={(layout, item) => {
        if (spanOf?.(item) === "full") layout.span = columns;
      }}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      onScroll={onScroll}
      scrollEventThrottle={32}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop, paddingBottom, paddingHorizontal: 10 }}
    />
  );
}

export function GridSkeleton({ count = 9 }: { count?: number }) {
  const { columns, cell } = useGridCell();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 }}>
      {Array.from({ length: count - (count % columns) }, (_, i) => (
        <Skeleton key={i} style={{ width: cell, aspectRatio: 2 / 3 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowContent: { paddingHorizontal: 16 },
});
