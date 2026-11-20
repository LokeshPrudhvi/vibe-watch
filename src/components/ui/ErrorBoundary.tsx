import { Component, type ErrorInfo, type ReactNode } from "react";

/** Last line of defence: a render crash shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook an error tracker (Sentry, etc.) in here.
    console.error("[vibe] render crash", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="grid min-h-dvh place-items-center bg-base px-6 text-center text-ink">
        <div className="max-w-sm">
          <p className="font-display text-3xl font-extrabold tracking-tight">That wasn't the vibe.</p>
          <p className="mt-3 text-sm text-muted">Something broke on this screen. Reloading usually fixes it.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-tint/10 px-5 py-2.5 text-sm font-semibold hover:bg-tint/15"
            >
              Reload
            </button>
            <a href="/" className="rounded-full px-5 py-2.5 text-sm font-semibold text-muted hover:text-ink">
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
