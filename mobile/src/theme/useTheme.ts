import { useColorScheme } from "react-native";
import { useSettings } from "@/store/settings";
import { palettes } from "./tokens";

/** Current palette from Settings → Appearance (Dark / Light / System). */
export function useTheme() {
  const mode = useSettings((s) => s.theme);
  const system = useColorScheme();
  const dark = mode === "system" ? system !== "light" : mode === "dark";
  return { dark, c: dark ? palettes.dark : palettes.light };
}
