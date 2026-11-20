import { useRef, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetContext } from "@/components/Glass";
import { FloatingNav, useNavSpace } from "@/components/FloatingNav";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/**
 * The tab screens live inside one BlurTargetView, which is what the navbar's glass blurs on
 * Android 12+. The navbar itself sits outside it (a view can't blur its own parent).
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const target = useRef<ComponentRef<typeof View>>(null);
  const navSpace = useNavSpace();

  return (
    <BlurTargetContext value={target}>
      <View style={{ flex: 1, backgroundColor: c.base }}>
        <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: c.base }}>
          <Tabs
            tabBar={() => null}
            backBehavior="history"
            screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.base } }}
          >
            <Tabs.Screen name="index" options={{ title: "Tonight" }} />
            <Tabs.Screen name="explore" options={{ title: "Explore" }} />
            <Tabs.Screen name="together" options={{ title: "Together" }} />
            <Tabs.Screen name="library" options={{ title: "Library" }} />
            <Tabs.Screen name="search" options={{ title: "Search" }} />
          </Tabs>
        </BlurTargetView>
        {/* content fades out under the navbar: a cheap stand-in for progressive blur */}
        <LinearGradient
          pointerEvents="none"
          colors={[alpha(c.base, 0), alpha(c.base, 0.85)]}
          style={[styles.fade, { height: navSpace }]}
        />
        <FloatingNav />
      </View>
    </BlurTargetContext>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
