import { ApiError, isRetryable } from "@/lib/tmdb";

const code = (s: string) => <code className="rounded bg-tint/10 px-1.5">{s}</code>;

function describe(error: unknown) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const api = error instanceof ApiError ? error : undefined;

  if (api?.code === "MISSING_TMDB_TOKEN" && import.meta.env.DEV) {
    return {
      title: "Add your TMDB token",
      body: (
        <>
          Copy {code(".env.example")} to {code(".env.local")}, paste your API Read Access Token into{" "}
          {code("TMDB_TOKEN")}, then restart {code("npm run dev")}.
        </>
      ),
    };
  }
  if (offline || api?.code === "NETWORK") {
    return { title: "You're offline", body: "Check your connection and try again." };
  }
  if (api?.code === "RATE_LIMITED" || api?.code === "UPSTREAM_RATE_LIMITED") {
    return { title: "Slow down a little", body: "Too many requests right now. Try again in a moment." };
  }
  return { title: "Couldn't load movies", body: "Something went wrong on our side. Please try again." };
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, body } = describe(error);
  const canRetry =
    !!onRetry &&
    (isRetryable(error) || (error instanceof ApiError && error.code.includes("RATE_LIMITED")));

  return (
    <div role="alert" className="rounded-[28px] bg-card p-6 ring-1 ring-edge/40">
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {import.meta.env.DEV && error instanceof Error && (
        <p className="mt-2 font-mono text-[11px] text-muted/70">{error.message}</p>
      )}
      {canRetry && (
        <button onClick={onRetry} className="mt-4 rounded-full bg-tint/10 px-4 py-2 text-sm font-semibold hover:bg-tint/15">
          Try again
        </button>
      )}
    </div>
  );
}
