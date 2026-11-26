import type { ReactNode } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { GlassPage, type AmbientSource } from "@/components/GlassPage";
import { LargeTitle, TopBar, useHeaderScroll, useHeaderSpace } from "@/components/Header";
import { useNavSpace } from "@/components/FloatingNav";
import { useTheme } from "@/theme/useTheme";

/**
 * A scrolling page with the large-title header, padded to clear the floating navbar. The page is a
 * GlassPage: its bar is live glass over the content, and `ambient` tints the page in liquid mode.
 */
export function Screen({
  title,
  eyebrow,
  children,
  back,
  settings,
  navbar = true,
  onRefresh,
  refreshing = false,
  ambient,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  back?: boolean;
  settings?: boolean;
  /** false on screens without the floating navbar */
  navbar?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** image the page's ambient backdrop is made from (liquid glass); defaults to trending */
  ambient?: AmbientSource;
}) {
  const { c } = useTheme();
  const header = useHeaderScroll();
  const top = useHeaderSpace();
  const navSpace = useNavSpace();

  return (
    <GlassPage
      ambient={ambient}
      bar={<TopBar title={title} scrolled={header.scrolled} collapsed={header.collapsed} back={back} settings={settings} />}
    >
      <ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: back ? top + 52 : top, paddingBottom: navbar ? navSpace : 48 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} progressViewOffset={top} />
          ) : undefined
        }
      >
        <LargeTitle title={title} eyebrow={eyebrow} />
        {children}
      </ScrollView>
    </GlassPage>
  );
}
