import "@/lib/api"; // points the shared TMDB client at the proxy before any query runs
import { useEffect } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { isRetryable } from "@shared/tmdb";
import { Toaster } from "@/components/Feedback";
import { useTheme } from "@/theme/useTheme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60_000,
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
    },
  },
});

export default function RootLayout() {
  const { dark, c } = useTheme();
  // Only the two display weights (imported by file, so the other five never ship);
  // body text uses the system font: smaller app, faster start.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold: require("@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf"),
    BricolageGrotesque_800ExtraBold: require("@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"),
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.base);
  }, [c.base]);

  if (!ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: c.base, card: c.card, text: c.ink, primary: c.ink } };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.base }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navTheme}>
            <StatusBar style={dark ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.base } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="title/[id]" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
            </Stack>
            <Toaster />
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
