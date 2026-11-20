/**
 * Rules for the taste log (mood, time budget, marks, signals), free of any store library.
 * Web and mobile wrap these in their own Zustand stores; the behaviour stays identical.
 */
import type { Mark, MarkType, MovieLite, Signal, SignalType } from "./recommend";
import type { MovieDetails, MovieSummary } from "./tmdb";
import type { MoodId } from "./moods";

export const TIME_MIN = 60;
export const TIME_MAX = 240;
export const MAX_SIGNALS = 300;
export const MAX_MARKS = 2000;

export const clampMinutes = (minutes: number) => Math.min(TIME_MAX, Math.max(TIME_MIN, minutes));

/** Choices that cancel each other out on the same title. */
export const CONFLICTS: Record<MarkType, MarkType[]> = {
  like: ["dislike"],
  dislike: ["like", "save"],
  seen: ["save"], // watched → no longer "watch later"
  save: ["dislike", "seen"],
};

export function toLite(m: MovieSummary | MovieDetails): MovieLite {
  const genres = "genre_ids" in m ? m.genre_ids : m.genres.map((g) => g.id);
  return {
    id: m.id,
    title: m.title,
    poster: m.poster_path,
    genres,
    lang: m.original_language,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) || undefined : undefined,
    date: m.release_date || undefined,
    status: "status" in m ? m.status : undefined,
  };
}

/** Adds a mark, dropping the same mark and any conflicting ones on that title. Newest first. */
export function addMark(marks: Mark[], type: MarkType, movie: MovieLite, now = Date.now()): Mark[] {
  const drop = new Set<MarkType>([type, ...CONFLICTS[type]]);
  const kept = marks.filter((m) => !(m.movie.id === movie.id && drop.has(m.type)));
  return [{ type, at: now, movie }, ...kept].slice(0, MAX_MARKS);
}

export function removeMark(marks: Mark[], type: MarkType, id: number): Mark[] {
  return marks.filter((m) => !(m.type === type && m.movie.id === id));
}

export const hasMark = (marks: Mark[], type: MarkType, id?: number) =>
  id ? marks.some((m) => m.type === type && m.movie.id === id) : false;

/** Records an implicit signal. The log is capped so it can't grow forever. */
export function addSignal(signals: Signal[], type: SignalType, movie?: MovieLite, now = Date.now()): Signal[] {
  return [
    {
      type,
      at: now,
      id: movie?.id || undefined,
      genres: movie?.genres ?? [],
      lang: movie?.lang,
      year: movie?.year,
    },
    ...signals,
  ].slice(0, MAX_SIGNALS);
}

export interface PersistedTaste {
  mood: MoodId;
  minutes: number;
  marks: Mark[];
  signals: Signal[];
}

export const DEFAULT_TASTE: PersistedTaste = { mood: "cozy", minutes: 130, marks: [], signals: [] };
export const TASTE_VERSION = 2;

/** v1 kept a hand-tuned genre affinity map; the event log replaces it. */
export function migrateTaste(persisted: unknown, version: number): PersistedTaste {
  const p = (persisted ?? {}) as Partial<PersistedTaste>;
  if (version < 2) return { ...DEFAULT_TASTE, mood: p.mood ?? "cozy", minutes: p.minutes ?? 130 };
  return { ...DEFAULT_TASTE, ...p };
}
