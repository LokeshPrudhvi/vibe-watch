import { Outlet } from "react-router";
import { BottomNav } from "./BottomNav";
import { ProgressiveBlur } from "./ProgressiveBlur";
import { useEffectiveGlass } from "@/store/useSettings";

export function AppShell() {
  const { progressive } = useEffectiveGlass();
  return (
    <div className="min-h-dvh bg-base text-ink">
      <main className="mx-auto max-w-6xl">
        <Outlet />
      </main>
      <Attribution />
      {/* bottom only: content melts into blur behind the floating navbar */}
      {progressive && <ProgressiveBlur edge="bottom" height="calc(env(safe-area-inset-bottom) + 112px)" />}
      <BottomNav />
    </div>
  );
}

/** Required by the TMDB API terms (and JustWatch, who supply the streaming availability). */
function Attribution() {
  const link = "font-semibold text-ink/80 underline-offset-2 hover:underline";
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-40 pt-14 text-[11px] leading-relaxed text-muted md:px-8">
      Movie data and images from{" "}
      <a className={link} href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
        TMDB
      </a>
      . This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by{" "}
      <a className={link} href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">
        JustWatch
      </a>
      .
    </footer>
  );
}
