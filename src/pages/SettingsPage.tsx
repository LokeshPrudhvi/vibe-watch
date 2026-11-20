import { useState } from "react";
import { useNavigate } from "react-router";
import { Gauge, Monitor, Moon, Palette, RotateCcw, Sparkles, Sun, UserRound, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Segmented, SettingRow, SettingsSection, Toggle } from "@/components/ui/Controls";
import { useTasteProfile } from "@/hooks/useTmdb";
import { useDocumentTitle } from "@/hooks/useUtils";
import { tasteSummary } from "@/lib/recommend";
import { supportsRefraction, useSettings, type MotionSpeed, type ThemeMode } from "@/store/useSettings";
import { useVibeStore } from "@/store/useVibeStore";
import { useQueryClient } from "@tanstack/react-query";
import { accountApi } from "@/hooks/useAccountSync";
import { authClient, useSession } from "@/lib/authClient";
import { useAccount } from "@/store/useAccount";
import { useToast } from "@/store/useToast";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const s = useSettings();
  // Dependencies show as a greyed-out switch, never as extra text: rows must not change height.
  const refractionAvailable = supportsRefraction() && s.liquidGlass && !s.glassPerformance;
  const progressiveAvailable = !s.glassPerformance && !(s.refraction && refractionAvailable);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mx-auto max-w-2xl space-y-8 px-4 pt-2 md:px-8">
        <AccountSection />

        <SettingsSection title="Themes" icon={Palette}>
          <div className="space-y-3 px-5 py-4">
            <p className="font-semibold">Appearance</p>
            <Segmented<ThemeMode>
              label="Appearance"
              layoutId="theme-mode"
              value={s.theme}
              onChange={(v) => s.set("theme", v)}
              options={[
                { value: "dark", label: "Dark", icon: Moon },
                { value: "light", label: "Light", icon: Sun },
                { value: "system", label: "System", icon: Monitor },
              ]}
            />
          </div>
          <SettingRow title="Liquid glass" description="Clear, light-catching glass on bars and buttons. Off uses classic frosted glass.">
            <Toggle label="Liquid glass" checked={s.liquidGlass} onChange={(v) => s.set("liquidGlass", v)} />
          </SettingRow>
          <SettingRow
            title="Real refracting glass"
            description="Bends what's behind the floating navbar like real glass. Needs Liquid glass. Android and Chromium only · uses more GPU."
            disabled={!refractionAvailable}
          >
            <Toggle
              label="Real refracting glass"
              checked={s.refraction && refractionAvailable}
              disabled={!refractionAvailable}
              onChange={(v) => s.set("refraction", v)}
            />
          </SettingRow>
          <SettingRow
            title="Progressive blur"
            description="Content melts into a gradual blur behind the navbar. Off while Real refracting glass is on."
            disabled={!progressiveAvailable}
          >
            <Toggle
              label="Progressive blur"
              checked={s.progressiveBlur && progressiveAvailable}
              disabled={!progressiveAvailable}
              onChange={(v) => s.set("progressiveBlur", v)}
            />
          </SettingRow>
          <SettingRow title="Reduce dynamic blur" description="Lighter blur behind floating bars. Easier to read over busy posters.">
            <Toggle label="Reduce dynamic blur" checked={s.reduceBlur} onChange={(v) => s.set("reduceBlur", v)} />
          </SettingRow>
          <SettingRow
            title="Better performance for glass"
            description="Cheaper glass for older phones: less blur, no refraction or progressive blur. Saves battery."
          >
            <Toggle
              label="Better performance for glass"
              checked={s.glassPerformance}
              onChange={(v) => s.set("glassPerformance", v)}
            />
          </SettingRow>
        </SettingsSection>

        <SettingsSection title="Animations" icon={Gauge}>
          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="font-semibold">Animation speed</p>
              <p className="mt-0.5 text-[13px] text-muted">
                Off makes every transition instant. Normal also respects your system's reduce-motion setting.
              </p>
            </div>
            <Segmented<MotionSpeed>
              label="Animation speed"
              layoutId="motion-speed"
              value={s.motion}
              onChange={(v) => s.set("motion", v)}
              options={[
                { value: "off", label: "Off" },
                { value: "slow", label: "Slow" },
                { value: "normal", label: "Normal" },
                { value: "fast", label: "Fast" },
              ]}
            />
          </div>
        </SettingsSection>

        <TasteSection />

        <button
          onClick={s.reset}
          className="mx-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink"
        >
          <RotateCcw className="size-4" /> Reset appearance to defaults
        </button>
      </div>
    </>
  );
}

function TasteSection() {
  const navigate = useNavigate();
  const profile = useTasteProfile();
  const marks = useVibeStore((s) => s.marks);
  const resetTaste = useVibeStore((s) => s.resetTaste);
  const [confirming, setConfirming] = useState(false);
  const summary = tasteSummary(profile);
  const count = (t: string) => marks.filter((m) => m.type === t).length;
  const learning = Math.round(profile.confidence * 100);

  return (
    <SettingsSection title="Recommendations" icon={Sparkles}>
      <div className="space-y-4 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">What we've learned</p>
            <p className="mt-0.5 text-[13px] text-muted">
              Worked out on this device from what you love, save, skip and watch. With activity sharing on, it
              also learns from people with similar taste.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl font-bold tabular-nums">{learning}%</p>
            <p className="text-[11px] text-muted">confidence</p>
          </div>
        </div>

        {summary.likes.length ? (
          <div className="flex flex-wrap gap-1.5">
            {summary.likes.map((g) => (
              <span key={g.id} className="rounded-full bg-tint/10 px-3 py-1 text-xs font-semibold">
                {g.name}
              </span>
            ))}
            {summary.languages.map((l) => (
              <span key={l} className="rounded-full bg-tint/10 px-3 py-1 text-xs font-semibold">
                {l}
              </span>
            ))}
            {summary.dislikes.map((g) => (
              <span key={g.id} className="rounded-full px-3 py-1 text-xs font-semibold text-muted ring-1 ring-tint/10">
                Less {g.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Wand2 className="size-4" /> Love or skip a few picks and your taste will show up here.
          </p>
        )}

        <p className="text-[13px] text-muted">
          {count("like")} loved · {count("save")} saved · {count("seen")} seen · {count("dislike")} hidden
        </p>
      </div>
      <SettingRow title="Tune with swipes" description="Swipe through famous films to sharpen your picks in under a minute.">
        <button
          onClick={() => navigate("/welcome")}
          className="h-10 w-36 shrink-0 rounded-full bg-tint/10 text-sm font-semibold hover:bg-tint/15"
        >
          Start swiping
        </button>
      </SettingRow>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <p className="text-[13px] text-muted">Clears your Library and starts recommendations from scratch.</p>
        {/* one fixed-width button: tap once to arm, again to confirm; it never changes the row's size */}
        <button
          onClick={() => {
            if (!confirming) return setConfirming(true);
            resetTaste();
            setConfirming(false);
          }}
          onBlur={() => setConfirming(false)}
          className={`h-10 w-36 shrink-0 rounded-full text-sm font-semibold transition-colors ${
            confirming ? "bg-edge font-bold text-night" : "bg-tint/10 hover:bg-tint/15"
          }`}
        >
          {confirming ? "Tap to confirm" : "Reset taste"}
        </button>
      </div>
    </SettingsSection>
  );
}

/** Account & privacy. Every row's text is fixed, so toggling never shifts the layout. */
function AccountSection() {
  const session = useSession();
  const user = session.data?.user;
  const consent = useAccount((s) => s.consent);
  const setConsent = useAccount((s) => s.setConsent);
  const openAccount = useAccount((s) => s.openAccount);
  const show = useToast((s) => s.show);
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    await authClient.signOut();
    qc.removeQueries({ queryKey: ["me"] });
    qc.removeQueries({ queryKey: ["crowd"] });
    show("Signed out. Your taste stays on this device.");
  };

  const deleteAccount = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await accountApi("/api/me", { method: "DELETE" });
      await authClient.signOut().catch(() => {});
      setConsent("no");
      qc.removeQueries({ queryKey: ["me"] });
      qc.removeQueries({ queryKey: ["crowd"] });
      show("Account and synced data deleted.");
    } catch {
      show("Couldn't delete the account. Try again.");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const btn = "h-10 w-32 shrink-0 rounded-full text-sm font-semibold transition-colors";
  return (
    <SettingsSection title="Account & privacy" icon={UserRound}>
      <SettingRow
        title={user ? "Signed in" : "Account"}
        description={user ? user.email : "Sync your taste across devices and get picks from people like you."}
      >
        {user ? (
          <button onClick={signOut} className={`${btn} bg-tint/10 hover:bg-tint/15`}>
            Sign out
          </button>
        ) : (
          <button onClick={openAccount} className={`${btn} bg-ink text-inverse`}>
            Sign in
          </button>
        )}
      </SettingRow>
      <SettingRow
        title="Share my activity"
        description="Your loves, saves, watches and skips are saved to your account and compared with other people's to find patterns. Nobody sees your list. Off deletes what we stored."
      >
        <Toggle
          label="Share my activity"
          checked={consent === "yes"}
          onChange={(v) => {
            setConsent(v ? "yes" : "no");
            if (v && !user) openAccount();
          }}
        />
      </SettingRow>
      {user && (
        <SettingRow title="Delete account" description="Removes your account and everything synced to it. This device keeps its own copy.">
          <button
            onClick={deleteAccount}
            onBlur={() => setConfirmDelete(false)}
            disabled={busy}
            className={`${btn} ${confirmDelete ? "bg-edge font-bold text-night" : "bg-tint/10 hover:bg-tint/15"}`}
          >
            {busy ? "Deleting…" : confirmDelete ? "Tap to confirm" : "Delete"}
          </button>
        </SettingRow>
      )}
    </SettingsSection>
  );
}
