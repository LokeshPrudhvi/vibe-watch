import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/authClient";
import { ApiError } from "@/lib/tmdb";
import type { Mark } from "@/lib/recommend";
import { diffTaste, markOp, mergeMarks, signalOp } from "@/lib/syncOps";
import { useAccount } from "@/store/useAccount";
import { useVibeStore } from "@/store/useVibeStore";
import { CONFLICTS } from "../../shared/taste";

export interface Me {
  user: { id: string; email: string; name: string };
  consent: { share: boolean; decidedAt: string } | null;
}

export interface CrowdItem {
  movieId: number;
  score: number;
  support: number;
  because: number;
}

/** JSON call to our own /api (cookie session, same origin). */
export async function accountApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(res.status, body?.error?.code ?? "SERVER_ERROR", body?.error?.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function useMe() {
  const session = useSession();
  const userId = session.data?.user.id;
  return useQuery({
    queryKey: ["me", userId],
    queryFn: () => accountApi<Me>("/api/me"),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** Signed in AND sharing switched on (on this device and on the server). */
export function useSharing() {
  const me = useMe();
  const consent = useAccount((s) => s.consent);
  return { me, active: consent === "yes" && !!me.data?.consent?.share };
}

/** "Users who loved what you loved also loved…" (server). Empty unless signed in + sharing. */
export function useCrowdItems() {
  const { me, active } = useSharing();
  return useQuery({
    queryKey: ["crowd", me.data?.user.id],
    queryFn: () => accountApi<{ items: CrowdItem[] }>("/api/me/crowd"),
    enabled: active,
    staleTime: 5 * 60_000,
    select: (d) => d.items,
  });
}

const BACKOFF = [5_000, 30_000, 120_000];

/**
 * Mount once. Keeps the server copy of the taste log in step with this device:
 *  1. every store change after a "yes" becomes upload ops (outbox survives reloads/offline);
 *  2. the server's consent is aligned with the user's choice once they're signed in;
 *  3. the first time an account syncs on this device: merge its Library in, upload ours;
 *  4. the outbox is flushed in batches, retrying with backoff.
 */
export function useAccountSync() {
  const qc = useQueryClient();
  const session = useSession();
  const userId = session.data?.user.id;
  const consent = useAccount((s) => s.consent);
  const outboxSize = useAccount((s) => s.outbox.length);
  const me = useMe();
  const serverShare = me.data?.consent?.share;
  const flushing = useRef(false);
  const attempt = useRef(0);
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 1. record changes
  useEffect(
    () =>
      useVibeStore.subscribe((next, prev) => {
        if (useAccount.getState().consent !== "yes") return;
        if (next.marks === prev.marks && next.signals === prev.signals) return;
        const ops = diffTaste(prev, next);
        if (ops.length) useAccount.getState().enqueue(ops);
      }),
    [],
  );

  // signed out → stop; don't carry this queue into whoever signs in next
  useEffect(() => {
    if (!session.isPending && !userId) useAccount.getState().dequeue(Infinity);
  }, [session.isPending, userId]);

  // 2. align server consent
  useEffect(() => {
    if (!userId || !me.data || consent === "unknown") return;
    const want = consent === "yes";
    if (me.data.consent && me.data.consent.share === want) return;
    accountApi("/api/me/consent", { method: "PUT", body: JSON.stringify({ share: want }) })
      .then(() => qc.invalidateQueries({ queryKey: ["me"] }))
      .catch(() => {});
  }, [userId, me.data, consent, qc]);

  // 3. first sync of this account on this device
  useEffect(() => {
    if (!userId || !serverShare || consent !== "yes") return;
    if (useAccount.getState().backfilled.includes(userId)) return;
    let cancelled = false;
    accountApi<{ marks: Mark[] }>("/api/me/marks")
      .then(({ marks: remote }) => {
        if (cancelled) return;
        const local = useVibeStore.getState();
        const merged = mergeMarks(local.marks, remote, CONFLICTS);
        useVibeStore.setState({ marks: merged });
        useAccount.getState().enqueue([...merged.map(markOp), ...local.signals.map(signalOp)]);
        useAccount.getState().markBackfilled(userId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, serverShare, consent]);

  // 4. flush
  useEffect(() => {
    if (!userId || !serverShare || consent !== "yes" || !outboxSize || flushing.current) return;
    flushing.current = true;
    (async () => {
      try {
        while (useAccount.getState().outbox.length) {
          const batch = useAccount.getState().outbox.slice(0, 200);
          await accountApi("/api/me/events", { method: "POST", body: JSON.stringify({ ops: batch }) });
          useAccount.getState().dequeue(batch.length);
        }
        attempt.current = 0;
        qc.invalidateQueries({ queryKey: ["crowd"] });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 401 || status === 403) {
          qc.invalidateQueries({ queryKey: ["me"] }); // session or consent changed elsewhere
        } else {
          clearTimeout(retry.current);
          const wait = BACKOFF[Math.min(attempt.current++, BACKOFF.length - 1)];
          retry.current = setTimeout(() => useAccount.setState((s) => ({ outbox: [...s.outbox] })), wait);
        }
      } finally {
        flushing.current = false;
      }
    })();
  }, [userId, serverShare, consent, outboxSize, qc]);

  useEffect(() => () => clearTimeout(retry.current), []);
}
