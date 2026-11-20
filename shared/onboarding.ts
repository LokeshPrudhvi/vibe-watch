/**
 * First-run "swipe to tune your taste" deck. Pure logic, shared by the web and phone apps.
 *
 * A good onboarding deck is made of films people RECOGNISE (or they can't judge them) and
 * that are as DIFFERENT from each other as possible (so every swipe teaches something new).
 */
import { decadeOf } from "./recommend";
import { todayISO, type MovieSummary } from "./tmdb";

export const DECK_SIZE = 15;
/** Swipes before "Done" unlocks; enough for a useful first profile. */
export const MIN_SWIPES = 5;

/**
 * Where candidates come from: the world's most-voted films plus the biggest films of each
 * major Indian industry, Korea and Japan. Each entry is one `discoverClassics` call.
 */
export const ONBOARDING_SOURCES: { key: string; language?: string; page?: number }[] = [
  { key: "world-1" },
  { key: "world-2", page: 2 },
  { key: "hi", language: "hi" },
  { key: "ta", language: "ta" },
  { key: "te", language: "te" },
  { key: "ml", language: "ml" },
  { key: "ko", language: "ko" },
  { key: "ja", language: "ja" },
];

/**
 * Greedy pick: each step takes the film that best balances fame and quality against what the
 * deck already covers (genres, original language, decade). A language may fill at most ~35%
 * of the deck. Deterministic for a given pool.
 */
export function buildOnboardingDeck(pool: MovieSummary[], size = DECK_SIZE, today = todayISO()): MovieSummary[] {
  const ids = new Set<number>();
  const remaining = pool.filter((m) => {
    if (ids.has(m.id) || !m.poster_path || m.vote_count < 300 || !m.release_date || m.release_date > today) return false;
    ids.add(m.id);
    return true;
  });

  const genreCount = new Map<number, number>();
  const langCount = new Map<string, number>();
  const eraCount = new Map<number, number>();
  const maxPerLanguage = Math.max(1, Math.ceil(size * 0.35));
  const picked: MovieSummary[] = [];

  while (picked.length < size && remaining.length) {
    let best = -1;
    let bestScore = -Infinity;
    remaining.forEach((m, i) => {
      const lang = m.original_language ?? "xx";
      if ((langCount.get(lang) ?? 0) >= maxPerLanguage) return;
      const fame = Math.log10(1 + m.vote_count) / 5;
      const quality = Math.min(1, Math.max(0, (m.vote_average - 6) / 2.5));
      const genreNovelty = m.genre_ids.length
        ? m.genre_ids.reduce((s, g) => s + 1 / (1 + (genreCount.get(g) ?? 0)), 0) / m.genre_ids.length
        : 0;
      const langNovelty = 1 / (1 + (langCount.get(lang) ?? 0));
      const era = decadeOf(Number(m.release_date.slice(0, 4))) ?? 0;
      const eraNovelty = 1 / (1 + (eraCount.get(era) ?? 0));
      const score = 0.9 * fame + 0.3 * quality + 0.6 * genreNovelty + 0.5 * langNovelty + 0.15 * eraNovelty;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) break;
    const [m] = remaining.splice(best, 1);
    picked.push(m);
    for (const g of m.genre_ids) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    const lang = m.original_language ?? "xx";
    langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
    const era = decadeOf(Number(m.release_date.slice(0, 4))) ?? 0;
    eraCount.set(era, (eraCount.get(era) ?? 0) + 1);
  }
  return picked;
}

export type SwipeDecision = "love" | "nope" | "skip";
