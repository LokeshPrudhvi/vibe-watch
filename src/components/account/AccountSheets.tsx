import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Sparkles, Users } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Segmented } from "@/components/ui/Controls";
import { authClient, useSession } from "@/lib/authClient";
import { useAccount } from "@/store/useAccount";
import { useOnboarding } from "@/store/useOnboarding";
import { useVibeStore } from "@/store/useVibeStore";
import { useLocation } from "react-router";
import { useToast } from "@/store/useToast";

/**
 * Asked once, on first launch: may we use your activity to find patterns across users?
 * Nothing leaves the device until the answer is yes AND the person is signed in.
 */
export function ConsentSheet() {
  const consent = useAccount((s) => s.consent);
  const setConsent = useAccount((s) => s.setConsent);
  const openAccount = useAccount((s) => s.openAccount);
  const session = useSession();
  const [ready, setReady] = useState(false);

  // let the first screen paint before asking
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // ask after first-run onboarding (one prompt at a time), never over the swipe deck
  const onWelcome = useLocation().pathname === "/welcome";
  const finishedOnboarding = useOnboarding((s) => s.status === "done");
  const hasTaste = useVibeStore((s) => s.marks.length > 0);
  const onboarded = finishedOnboarding || hasTaste;
  const open = ready && consent === "unknown" && onboarded && !onWelcome;
  const decline = () => setConsent("no");

  return (
    <Sheet open={open} onClose={decline} title="Better picks from people like you">
      <h2 className="pr-10 font-display text-2xl font-extrabold tracking-tight">Better picks from people like you?</h2>
      <ul className="mt-4 space-y-3 text-sm text-ink/85">
        <li className="flex gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-muted" />
          We save what you love, save, watch, skip and open to your account, so your taste follows you to any device.
        </li>
        <li className="flex gap-3">
          <Users className="mt-0.5 size-4 shrink-0 text-muted" />
          We compare it with other people's choices to find films fans like you loved. Nobody sees your list, and a
          pattern needs at least 3 people.
        </li>
        <li className="flex gap-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted" />
          Turn it off any time in Settings. That deletes what we stored.
        </li>
      </ul>
      <div className="mt-6 grid gap-2">
        <button
          onClick={() => {
            setConsent("yes");
            if (!session.data) openAccount();
          }}
          className="h-12 rounded-full bg-ink text-sm font-bold text-inverse"
        >
          {session.data ? "Yes, share my activity" : "Yes, share and sign in"}
        </button>
        <button onClick={decline} className="h-12 rounded-full text-sm font-semibold text-muted hover:text-ink">
          Not now
        </button>
      </div>
      <p className="mt-3 text-center text-[12px] text-muted">
        Everything works without an account. Your taste stays on this device.
      </p>
    </Sheet>
  );
}

type Mode = "signup" | "signin";

export function AccountSheet() {
  const open = useAccount((s) => s.accountOpen);
  const close = useAccount((s) => s.closeAccount);
  const show = useToast((s) => s.show);
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setPassword("");
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } =
      mode === "signup"
        ? await authClient.signUp.email({ name: name.trim() || email.split("@")[0], email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(err.message || (mode === "signup" ? "Couldn't create the account." : "Wrong email or password."));
      return;
    }
    qc.invalidateQueries({ queryKey: ["me"] });
    close();
    show(mode === "signup" ? "Account created. You're signed in." : "Signed in.");
  }

  const field =
    "h-12 w-full rounded-2xl bg-tint/6 px-4 text-[15px] text-ink outline-none ring-1 ring-tint/10 placeholder:text-muted focus:ring-2 focus:ring-ink/40";

  return (
    <Sheet open={open} onClose={close} title={mode === "signup" ? "Create account" : "Sign in"}>
      <h2 className="pr-10 font-display text-2xl font-extrabold tracking-tight">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h2>
      <p className="mt-1 text-sm text-muted">Sync your taste across devices and get picks from people like you.</p>
      <div className="mt-5">
        <Segmented<Mode>
          label="Account"
          layoutId="account-mode"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: "signup", label: "Create account" },
            { value: "signin", label: "Sign in" },
          ]}
        />
      </div>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        {mode === "signup" && (
          <input className={field} placeholder="Name (optional)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input
          className={field}
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={field}
          type="password"
          required
          minLength={8}
          placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-edge">
            {error}
          </p>
        )}
        <button disabled={busy} className="mt-1 h-12 rounded-full bg-ink text-sm font-bold text-inverse disabled:opacity-50">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </Sheet>
  );
}
