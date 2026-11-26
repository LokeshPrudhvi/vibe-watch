import { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Eye from "lucide-react-native/icons/eye";
import Heart from "lucide-react-native/icons/heart";
import ThumbsDown from "lucide-react-native/icons/thumbs-down";
import Trash2 from "lucide-react-native/icons/trash-2";
import type { Mark, MarkType } from "@shared/recommend";
import { Segmented } from "@/components/Controls";
import { useNavSpace } from "@/components/FloatingNav";
import { GlassPage } from "@/components/GlassPage";
import { LargeTitle, TopBar, useHeaderScroll, useHeaderSpace } from "@/components/Header";
import { Poster, PosterGrid, openTitle } from "@/components/Posters";
import { Sheet } from "@/components/Sheet";
import { Empty, Tap, Txt } from "@/components/ui";
import { persistStorage } from "@/lib/storage";
import { useToast } from "@/store/ui";
import { useVibeStore } from "@/store/vibe";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const SHELVES: { type: MarkType; label: string; Icon: typeof Heart; empty: string; remove: string; removed: string }[] = [
  { type: "save", label: "Saved", Icon: Bookmark, empty: "Tap Save on any pick to watch it later.", remove: "Remove from Saved", removed: "Removed from Saved" },
  { type: "like", label: "Loved", Icon: Heart, empty: "Movies you love teach your recommendations the most.", remove: "Unlove", removed: "Removed from Loved" },
  { type: "seen", label: "Seen", Icon: Eye, empty: "Mark what you've watched and we'll stop suggesting it.", remove: "Remove from Seen", removed: "Removed from Seen" },
  { type: "dislike", label: "Hidden", Icon: ThumbsDown, empty: "Titles you said aren't for you show up here.", remove: "Unhide", removed: "Unhidden" },
];

/** "Long-press a poster for options" shows until the first long-press, then never again. */
const useLibraryHint = create<{ learned: boolean; learn: () => void }>()(
  persist((set) => ({ learned: false, learn: () => set({ learned: true }) }), { name: "vibe-library-hint", storage: persistStorage }),
);

export default function LibraryScreen() {
  const { c } = useTheme();
  const [shelf, setShelf] = useState<MarkType>("save");
  const [menu, setMenu] = useState<Mark | null>(null);
  const marks = useVibeStore((s) => s.marks);
  const learned = useLibraryHint((s) => s.learned);
  const learn = useLibraryHint((s) => s.learn);
  const header = useHeaderScroll();
  const top = useHeaderSpace();
  const navSpace = useNavSpace();
  const current = SHELVES.find((s) => s.type === shelf)!;
  const items = marks.filter((m) => m.type === shelf);

  const head = (
    <View style={{ gap: 16, paddingBottom: 16, marginHorizontal: -10 }}>
      <LargeTitle title="Library" eyebrow="Kept on this device" />
      <View style={{ paddingHorizontal: 16 }}>
        <Segmented
          label="Shelf"
          value={shelf}
          onChange={setShelf}
          options={SHELVES.map((s) => ({ value: s.type, label: s.label }))}
        />
      </View>
      {items.length === 0 ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Empty text={current.empty}>
            <current.Icon size={32} color={c.muted} />
          </Empty>
        </View>
      ) : !learned ? (
        <Txt variant="caption" muted style={{ paddingHorizontal: 16, marginTop: -4, fontSize: 12, lineHeight: 16 }}>
          Long-press a poster to remove it or mark it seen.
        </Txt>
      ) : null}
    </View>
  );

  return (
    <GlassPage
      ambient={{ path: items[0]?.movie.poster, kind: "poster" }}
      bar={<TopBar title="Library" scrolled={header.scrolled} collapsed={header.collapsed} />}
    >
      <PosterGrid<Mark>
        data={items}
        keyOf={(m) => `${m.type}-${m.movie.id}`}
        header={head}
        onScroll={header.onScroll}
        paddingTop={top}
        paddingBottom={navSpace}
        renderCell={(m, cell) => (
          <Tap
            scaleTo={0.96}
            accessibilityLabel={m.movie.title}
            accessibilityHint="Long-press for options"
            accessibilityActions={[{ name: "longpress", label: "Options" }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && setMenu(m)}
            onPress={() => openTitle(m.movie.id, m.movie.poster)}
            delayLongPress={350}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              learn();
              setMenu(m);
            }}
            style={{ width: cell }}
          >
            <Poster path={m.movie.poster} width={cell} id={m.movie.id} />
            <Txt variant="label" numberOfLines={1} style={{ marginTop: 6, fontSize: 12 }}>
              {m.movie.title}
            </Txt>
          </Tap>
        )}
      />
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.movie.title}>
        {menu && <MarkMenu mark={menu} shelf={current} onDone={() => setMenu(null)} />}
      </Sheet>
    </GlassPage>
  );
}

/** What a long-press offers: open, mark seen (Saved only) and remove, each with an Undo toast. */
function MarkMenu({ mark, shelf, onDone }: { mark: Mark; shelf: (typeof SHELVES)[number]; onDone: () => void }) {
  const { c } = useTheme();
  const markAs = useVibeStore((s) => s.mark);
  const unmark = useVibeStore((s) => s.unmark);
  const show = useToast((s) => s.show);
  const { movie } = mark;

  // snapshot first, so Undo restores exactly what was there (e.g. the Save that Seen replaced)
  const change = (apply: () => void, text: string) => {
    const before = useVibeStore.getState().marks;
    apply();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    show(text, () => useVibeStore.setState({ marks: before }));
    onDone();
  };

  return (
    <View style={{ gap: 4 }}>
      <MenuRow
        label="Open details"
        Icon={ChevronRight}
        onPress={() => {
          onDone();
          openTitle(movie.id, movie.poster);
        }}
      />
      {shelf.type === "save" && (
        <MenuRow label="Mark as seen" Icon={Eye} onPress={() => change(() => markAs("seen", movie), `Marked ${movie.title} as seen`)} />
      )}
      <MenuRow
        label={shelf.remove}
        Icon={Trash2}
        color={c.edge}
        onPress={() => change(() => unmark(shelf.type, movie.id), `${shelf.removed}: ${movie.title}`)}
      />
    </View>
  );
}

function MenuRow({ label, Icon, color, onPress }: { label: string; Icon: typeof Heart; color?: string; onPress: () => void }) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Tap scaleTo={0.98} onPress={onPress} accessibilityLabel={label} style={[styles.row, { backgroundColor: alpha(c.tint, 0.06) }]}>
      <Icon size={20} color={ink} />
      <Txt variant="label" style={{ fontSize: 16, color: ink }}>
        {label}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { height: 54, borderRadius: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 },
});
