import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig, MotionGlobalConfig } from "motion/react";
import { MOTION_SCALE, useEffectiveGlass, useSettings } from "@/store/useSettings";
import { scaleTransition } from "@/lib/motion";

const THEME_COLOR = { dark: "#0e0e0e", light: "#f2f2f2" } as const;

function useSystemLight() {
  const query = "(prefers-color-scheme: light)";
  const [light, setLight] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setLight(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return light;
}

/** Mirrors Settings onto <html data-*> attributes (read by index.css) and configures Motion. */
export function AppearanceSync({ children }: { children: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const speed = useSettings((s) => s.motion);
  const glass = useEffectiveGlass();
  const systemLight = useSystemLight();
  const resolved = theme === "system" ? (systemLight ? "light" : "dark") : theme;
  const k = MOTION_SCALE[speed];

  useEffect(() => {
    const root = document.documentElement.dataset;
    root.theme = resolved;
    root.liquid = glass.liquid ? "on" : "off";
    root.blur = glass.reduced ? "reduced" : "normal";
    root.glassPerf = glass.perf ? "on" : "off";
    root.motion = speed;
    document.documentElement.style.setProperty("--motion-scale", String(k || 0.0001));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
    MotionGlobalConfig.skipAnimations = speed === "off";
  }, [resolved, glass.liquid, glass.reduced, glass.perf, speed, k]);

  return (
    <MotionConfig
      reducedMotion={speed === "off" ? "always" : "user"}
      transition={scaleTransition({ type: "spring", stiffness: 400, damping: 34 }, k)}
    >
      {children}
    </MotionConfig>
  );
}
