import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, StyleSheet, TextInput, View } from "react-native";
import { router, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Compass from "lucide-react-native/icons/compass";
import LibraryBig from "lucide-react-native/icons/library-big";
import MoonStar from "lucide-react-native/icons/moon-star";
import Search from "lucide-react-native/icons/search";
import UsersRound from "lucide-react-native/icons/users-round";
import X from "lucide-react-native/icons/x";
import { Glass, useGlassInk } from "@/components/Glass";
import { Tap, Txt } from "@/components/ui";
import { SPRING, useMotion } from "@/lib/motion";
import { useSearch } from "@/store/ui";
import { useEffectiveGlass } from "@/store/settings";
import { BAR, alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export const TABS = [
  { href: "/", label: "Tonight", Icon: MoonStar },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/together", label: "Together", Icon: UsersRound },
  { href: "/library", label: "Library", Icon: LibraryBig },
] as const;

type TabHref = (typeof TABS)[number]["href"];

/** Room the scroll views leave at the bottom so content can scroll out from under the navbar. */
export const useNavSpace = () => BAR + Math.max(useSafeAreaInsets().bottom, 12) + 28;

/**
 * Floating navbar in two parts, like the website: a tab group and a separate search button.
 * On Search the two swap roles: the tabs shrink into a close button and the search button grows
 * into the search field, so typing happens right by your thumb. The morph is a Reanimated layout
 * transition and the active-tab pill is a spring, both on the UI thread.
 */
export function FloatingNav() {
  const pathname = usePathname();
  const searching = pathname === "/search";
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const layout = motion.layout(SPRING.nav);
  const lastTab = useRef<TabHref>("/");
  const bottom = Math.max(insets.bottom, 12);
  const active = TABS.findIndex((t) => t.href === pathname);

  useEffect(() => {
    if (active >= 0) lastTab.current = TABS[active].href;
  }, [active]);

  // ride on top of the keyboard while typing a search
  const keyboard = useReanimatedKeyboardAnimation();
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(0, keyboard.height.get() + bottom - 8) }],
  }));

  const closeSearch = () => {
    Keyboard.dismiss();
    router.navigate(lastTab.current);
  };

  return (
    <Animated.View pointerEvents="box-none" style={[styles.nav, { paddingBottom: bottom }, lift]}>
      <View style={styles.row}>
        <Animated.View layout={layout} style={searching ? styles.round : styles.grow}>
          <Glass radius={BAR / 2} style={styles.fill} interactive>
            {searching ? (
              <NavFade key="close">
                <Tap onPress={closeSearch} accessibilityLabel="Close search" style={styles.center}>
                  <NavIcon Icon={X} />
                </Tap>
              </NavFade>
            ) : (
              <NavFade key="tabs">
                <TabsPill active={active} />
              </NavFade>
            )}
          </Glass>
        </Animated.View>

        <Animated.View layout={layout} style={searching ? styles.grow : styles.round}>
          <Glass radius={BAR / 2} style={styles.fill} interactive>
            {searching ? (
              <NavFade key="field">
                <SearchField />
              </NavFade>
            ) : (
              <NavFade key="search">
                <Tap onPress={() => router.navigate("/search")} accessibilityLabel="Search" style={styles.center}>
                  <NavIcon Icon={Search} />
                </Tap>
              </NavFade>
            )}
          </Glass>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/**
 * Fades the swapped-in navbar content in on mount. A plain shared value, not a Reanimated
 * `entering` animation: on Android New Arch those sometimes never start when the view mounts
 * mid-layout and the icons stay at opacity 0. This always lands on 1.
 */
function NavFade({ children }: { children: ReactNode }) {
  const motion = useMotion();
  const ms = motion.duration(180);
  const shown = useSharedValue(ms ? 0 : 1);
  useEffect(() => {
    shown.set(ms ? withTiming(1, { duration: ms }) : 1);
  }, [ms, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return <Animated.View style={[styles.fill, fade]}>{children}</Animated.View>;
}

function NavIcon({ Icon }: { Icon: typeof Search }) {
  const ink = useGlassInk();
  return (
    <View style={ink.halo}>
      <Icon size={26} color={ink.ink} strokeWidth={2.1} />
    </View>
  );
}

const PAD = 6;

function TabsPill({ active }: { active: number }) {
  const { c, dark } = useTheme();
  const { liquid } = useEffectiveGlass();
  const ink = useGlassInk();
  const motion = useMotion();
  const spring = motion.spring(SPRING.pill);
  const [width, setWidth] = useState(0);
  const tabW = width ? (width - PAD * 2) / TABS.length : 0;
  const x = useSharedValue(-1);

  useEffect(() => {
    if (!tabW || active < 0) return;
    const to = active * tabW;
    // first placement jumps; later changes slide
    x.set(x.get() < 0 || !spring ? to : withSpring(to, spring));
  }, [active, tabW, spring, x]);

  const pill = useAnimatedStyle(() => ({
    opacity: x.get() < 0 ? 0 : 1,
    transform: [{ translateX: Math.max(0, x.get()) }],
  }));

  return (
    <View style={styles.fill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tabW > 0 && active >= 0 && (
        <Animated.View
          style={[
            styles.pill,
            { width: tabW, top: PAD, bottom: PAD, left: PAD, backgroundColor: alpha(c.tint, liquid ? 0.12 : 0.1) },
            // liquid: a small lit lens inside the bar (top highlight + soft drop shadow)
            liquid && {
              borderTopWidth: StyleSheet.hairlineWidth * 2,
              borderTopColor: alpha("#ffffff", dark ? 0.35 : 0.9),
              boxShadow: `0 6px 16px -8px ${c.shadow}`,
            },
            pill,
          ]}
        />
      )}
      {/* icons and labels share one layer, so one halo keeps them readable on clear glass */}
      <View style={[StyleSheet.absoluteFill, styles.tabs, ink.halo]}>
        {TABS.map(({ href, label, Icon }, i) => {
          const on = i === active;
          return (
            <Tap
              key={href}
              scaleTo={0.9}
              onPress={() => {
                if (!on) Haptics.selectionAsync();
                router.navigate(href);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              style={styles.tab}
            >
              <Icon size={26} color={on ? ink.ink : ink.soft} strokeWidth={on ? 2.3 : 1.9} />
              <Txt variant="caption" numberOfLines={1} style={{ fontWeight: "600", color: on ? ink.ink : ink.soft }}>
                {label}
              </Txt>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

function SearchField() {
  const { c } = useTheme();
  const ink = useGlassInk();
  const query = useSearch((s) => s.query);
  const setQuery = useSearch((s) => s.setQuery);
  return (
    <View style={[styles.fill, { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 20, paddingRight: 8 }]}>
      <View style={ink.halo}>
        <Search size={22} color={ink.soft} />
      </View>
      <TextInput
        autoFocus
        value={query}
        onChangeText={setQuery}
        placeholder="Search movies"
        placeholderTextColor={ink.soft}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Search movies"
        selectionColor={c.ink}
        style={{ flex: 1, height: "100%", fontSize: 17, color: c.ink }}
      />
      {query ? (
        <Tap
          onPress={() => setQuery("")}
          accessibilityLabel="Clear search"
          style={[styles.clear, { backgroundColor: alpha(c.tint, 0.1) }]}
        >
          <X size={16} color={c.muted} />
        </Tap>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", maxWidth: 576, alignSelf: "center" },
  grow: { flex: 1, height: BAR },
  round: { width: BAR, height: BAR },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pill: { position: "absolute", borderRadius: 999 },
  tabs: { flexDirection: "row", padding: PAD },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 999 },
  clear: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
