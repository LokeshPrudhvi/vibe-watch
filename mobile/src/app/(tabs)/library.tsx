import { useState } from "react";
import { View } from "react-native";
import Bookmark from "lucide-react-native/icons/bookmark";
import Eye from "lucide-react-native/icons/eye";
import Heart from "lucide-react-native/icons/heart";
import ThumbsDown from "lucide-react-native/icons/thumbs-down";
import X from "lucide-react-native/icons/x";
import type { Mark, MarkType } from "@shared/recommend";
import { Segmented } from "@/components/Controls";
import { useNavSpace } from "@/components/FloatingNav";
import { LargeTitle, TopBar, useHeaderScroll, useHeaderSpace } from "@/components/Header";
import { Poster, PosterGrid, openTitle } from "@/components/Posters";
import { Empty, Tap, Txt } from "@/components/ui";
import { useVibeStore } from "@/store/vibe";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const SHELVES: { type: MarkType; label: string; Icon: typeof Heart; empty: string; remove: string }[] = [
  { type: "save", label: "Saved", Icon: Bookmark, empty: "Tap Save on any pick to watch it later.", remove: "Remove from Saved" },
  { type: "like", label: "Loved", Icon: Heart, empty: "Movies you love teach your recommendations the most.", remove: "Unlove" },
  { type: "seen", label: "Seen", Icon: Eye, empty: "Mark what you've watched and we'll stop suggesting it.", remove: "Remove from Seen" },
  { type: "dislike", label: "Hidden", Icon: ThumbsDown, empty: "Titles you said aren't for you show up here.", remove: "Unhide" },
];

export default function LibraryScreen() {
  const { c } = useTheme();
  const [shelf, setShelf] = useState<MarkType>("save");
  const marks = useVibeStore((s) => s.marks);
  const unmark = useVibeStore((s) => s.unmark);
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
      {items.length === 0 && (
        <View style={{ paddingHorizontal: 16 }}>
          <Empty text={current.empty}>
            <current.Icon size={32} color={c.muted} />
          </Empty>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.base }}>
      <PosterGrid<Mark>
        data={items}
        keyOf={(m) => `${m.type}-${m.movie.id}`}
        header={head}
        onScroll={header.onScroll}
        paddingTop={top}
        paddingBottom={navSpace}
        renderCell={({ movie }, cell) => (
          <View style={{ width: cell }}>
            <Tap scaleTo={0.96} accessibilityLabel={movie.title} onPress={() => openTitle(movie.id, movie.poster)}>
              <Poster path={movie.poster} width={cell} id={movie.id} />
              <Txt variant="label" numberOfLines={1} style={{ marginTop: 6, fontSize: 12 }}>
                {movie.title}
              </Txt>
            </Tap>
            <Tap
              onPress={() => unmark(shelf, movie.id)}
              accessibilityLabel={`${current.remove}: ${movie.title}`}
              hitSlop={6}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: alpha(c.card, 0.85),
                borderWidth: 1,
                borderColor: alpha(c.tint, 0.1),
              }}
            >
              <X size={15} color={c.ink} />
            </Tap>
          </View>
        )}
      />
      <TopBar title="Library" scrolled={header.scrolled} collapsed={header.collapsed} />
    </View>
  );
}
