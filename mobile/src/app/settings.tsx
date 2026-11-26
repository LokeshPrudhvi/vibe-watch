import { useState } from "react";
import Constants from "expo-constants";
import { View } from "react-native";
import Gauge from "lucide-react-native/icons/gauge";
import Monitor from "lucide-react-native/icons/monitor";
import Moon from "lucide-react-native/icons/moon";
import Palette from "lucide-react-native/icons/palette";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import Sparkles from "lucide-react-native/icons/sparkles";
import Sun from "lucide-react-native/icons/sun";
import Wand2 from "lucide-react-native/icons/wand-sparkles";
import { tasteSummary } from "@shared/recommend";
import { Segmented, SettingRow, SettingsSection, Toggle } from "@/components/Controls";
import { Screen } from "@/components/Screen";
import { Tap, Txt } from "@/components/ui";
import { useTasteProfile } from "@/hooks/tmdb";
import { API_BASE } from "@/lib/api";
import { isLowEndDevice, useSettings, type MotionSpeed, type ThemeMode } from "@/store/settings";
import { useVibeStore } from "@/store/vibe";
import { alpha } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function SettingsScreen() {
  const { c } = useTheme();
  const s = useSettings();

  return (
    <Screen title="Settings" back settings={false} navbar={false}>
      <View style={{ paddingHorizontal: 16, gap: 28, paddingTop: 4 }}>
        <SettingsSection title="Themes" Icon={Palette}>
          <View style={{ padding: 20, gap: 12 }}>
            <Txt variant="label" style={{ fontSize: 15 }}>
              Appearance
            </Txt>
            <Segmented<ThemeMode>
              label="Appearance"
              value={s.theme}
              onChange={(v) => s.set("theme", v)}
              options={[
                { value: "dark", label: "Dark", Icon: Moon },
                { value: "light", label: "Light", Icon: Sun },
                { value: "system", label: "System", Icon: Monitor },
              ]}
            />
          </View>
          <SettingRow title="Liquid glass" description="Clear, light-catching glass on every page. Off uses classic frosted glass.">
            <Toggle label="Liquid glass" checked={s.liquidGlass} onChange={(v) => s.set("liquidGlass", v)} />
          </SettingRow>
          <SettingRow
            title="Reduce dynamic blur"
            description="Calmer, more solid glass. Easier to read over busy posters."
            disabled={s.glassPerformance}
          >
            <Toggle
              label="Reduce dynamic blur"
              checked={s.reduceBlur}
              disabled={s.glassPerformance}
              onChange={(v) => s.set("reduceBlur", v)}
            />
          </SettingRow>
          <SettingRow
            title="Better performance for glass"
            description={`No live blur, mostly solid bars. Saves battery on older phones.${isLowEndDevice() ? " On by default on this phone." : ""}`}
          >
            <Toggle
              label="Better performance for glass"
              checked={s.glassPerformance}
              onChange={(v) => s.set("glassPerformance", v)}
            />
          </SettingRow>
        </SettingsSection>

        <SettingsSection title="Animations" Icon={Gauge}>
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ gap: 2 }}>
              <Txt variant="label" style={{ fontSize: 15 }}>
                Animation speed
              </Txt>
              <Txt variant="small" muted>
                Off makes every transition instant. Normal also follows your phone&apos;s reduce-motion setting.
              </Txt>
            </View>
            <Segmented<MotionSpeed>
              label="Animation speed"
              value={s.motion}
              onChange={(v) => s.set("motion", v)}
              options={[
                { value: "off", label: "Off" },
                { value: "slow", label: "Slow" },
                { value: "normal", label: "Normal" },
                { value: "fast", label: "Fast" },
              ]}
            />
          </View>
        </SettingsSection>

        <TasteSection />

        <Tap onPress={s.reset} style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, padding: 10 }}>
          <RotateCcw size={16} color={c.muted} />
          <Txt variant="label" muted>
            Reset appearance to defaults
          </Txt>
        </Tap>

        <Txt variant="caption" muted style={{ lineHeight: 16 }}>
          Data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming
          availability by JustWatch.
          {__DEV__ ? `\nServer: ${API_BASE}` : ""}
        </Txt>
        {/* so you can confirm an update really installed */}
        <Txt variant="caption" muted style={{ textAlign: "center" }}>
          vibe {Constants.expoConfig?.version ?? "?"}
          {Constants.expoConfig?.android?.versionCode ? ` (build ${Constants.expoConfig.android.versionCode})` : ""}
        </Txt>
      </View>
    </Screen>
  );
}

function TasteSection() {
  const { c } = useTheme();
  const profile = useTasteProfile();
  const marks = useVibeStore((s) => s.marks);
  const resetTaste = useVibeStore((s) => s.resetTaste);
  const [confirming, setConfirming] = useState(false);
  const summary = tasteSummary(profile);
  const count = (t: string) => marks.filter((m) => m.type === t).length;
  const learning = Math.round(profile.confidence * 100);

  return (
    <SettingsSection title="Recommendations" Icon={Sparkles}>
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="label" style={{ fontSize: 15 }}>
              What we&apos;ve learned
            </Txt>
            <Txt variant="small" muted>
              Worked out on this phone from what you love, save, skip and watch. Nothing is uploaded.
            </Txt>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Txt variant="heading" style={{ fontSize: 24, lineHeight: 28 }}>
              {learning}%
            </Txt>
            <Txt variant="caption" muted>
              confidence
            </Txt>
          </View>
        </View>

        {summary.likes.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[...summary.likes.map((g) => g.name), ...summary.languages].map((name) => (
              <View key={name} style={{ borderRadius: 999, backgroundColor: alpha(c.tint, 0.1), paddingHorizontal: 12, paddingVertical: 4 }}>
                <Txt variant="caption" style={{ fontSize: 12, fontWeight: "600" }}>
                  {name}
                </Txt>
              </View>
            ))}
            {summary.dislikes.map((g) => (
              <View
                key={g.id}
                style={{ borderRadius: 999, borderWidth: 1, borderColor: alpha(c.tint, 0.1), paddingHorizontal: 12, paddingVertical: 4 }}
              >
                <Txt variant="caption" muted style={{ fontSize: 12, fontWeight: "600" }}>
                  Less {g.name}
                </Txt>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Wand2 size={16} color={c.muted} />
            <Txt variant="small" muted style={{ flex: 1 }}>
              Love or skip a few picks and your taste will show up here.
            </Txt>
          </View>
        )}

        <Txt variant="small" muted>
          {count("like")} loved · {count("save")} saved · {count("seen")} seen · {count("dislike")} hidden
        </Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}>
        <Txt variant="small" muted style={{ flex: 1 }}>
          Clears your Library and starts recommendations from scratch.
        </Txt>
        {/* tap once to arm, again to confirm; fixed width so the row never changes size */}
        <Tap
          onPress={() => {
            if (!confirming) return setConfirming(true);
            resetTaste();
            setConfirming(false);
          }}
          style={{
            height: 40,
            width: 136,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: confirming ? c.edge : alpha(c.tint, 0.1),
          }}
        >
          <Txt variant="label" style={{ color: confirming ? c.night : c.ink, fontWeight: confirming ? "700" : "600" }}>
            {confirming ? "Tap to confirm" : "Reset taste"}
          </Txt>
        </Tap>
      </View>
    </SettingsSection>
  );
}
