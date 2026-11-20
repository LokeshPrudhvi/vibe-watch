/**
 * Pure helpers for syncing the on-device taste log to the server (no React, no storage).
 * Wire format matches server/sync.ts.
 */
import type { Mark, MarkType, MovieLite, Signal, SignalType } from "@/lib/recommend";

export type SyncOp =
  | { op: "mark"; type: MarkType; at: number; movie: MovieLite }
  | { op: "unmark"; type: MarkType; at: number; movieId: number }
  | { op: "signal"; type: SignalType; at: number; clientId: string; movieId?: number; genres: number[]; lang?: string };

const markKey = (m: Mark) => `${m.type}:${m.movie.id}`;
export const signalId = (s: Signal) => `${s.type}:${s.at}:${s.id ?? 0}`;

export function markOp(m: Mark): SyncOp {
  return { op: "mark", type: m.type, at: m.at, movie: m.movie };
}

export function signalOp(s: Signal): SyncOp {
  return {
    op: "signal",
    type: s.type,
    at: s.at,
    clientId: signalId(s),
    ...(s.id ? { movieId: s.id } : {}),
    genres: s.genres,
    ...(s.lang ? { lang: s.lang } : {}),
  };
}

/**
 * What changed between two snapshots of the taste log, as upload ops. New or re-dated marks
 * → mark; vanished marks (unmarked, replaced by a conflicting choice, or a taste reset) →
 * unmark; new signals → signal.
 */
export function diffTaste(
  prev: { marks: Mark[]; signals: Signal[] },
  next: { marks: Mark[]; signals: Signal[] },
  now = Date.now(),
): SyncOp[] {
  const ops: SyncOp[] = [];
  const before = new Map(prev.marks.map((m) => [markKey(m), m]));
  const after = new Map(next.marks.map((m) => [markKey(m), m]));
  for (const [k, m] of after) if (before.get(k)?.at !== m.at) ops.push(markOp(m));
  for (const [k, m] of before) if (!after.has(k)) ops.push({ op: "unmark", type: m.type, at: now, movieId: m.movie.id });

  const seen = new Set(prev.signals.map(signalId));
  for (const s of next.signals) if (!seen.has(signalId(s))) ops.push(signalOp(s));
  return ops;
}

/**
 * Merges the account's marks (from another device) into this device's. Per movie the newest
 * choice wins, and choices that contradict it (like vs dislike, save vs seen) are dropped,
 * matching the conflict rules in shared/taste.ts.
 */
export function mergeMarks(local: Mark[], remote: Mark[], conflicts: Record<MarkType, MarkType[]>): Mark[] {
  const byKey = new Map<string, Mark>();
  for (const m of [...local, ...remote]) {
    const k = markKey(m);
    const prev = byKey.get(k);
    if (!prev || prev.at < m.at) byKey.set(k, m);
  }
  const all = [...byKey.values()].sort((a, b) => b.at - a.at); // newest first
  const kept: Mark[] = [];
  for (const m of all) {
    const beaten = kept.some((k) => k.movie.id === m.movie.id && conflicts[k.type].includes(m.type));
    if (!beaten) kept.push(m);
  }
  return kept;
}
