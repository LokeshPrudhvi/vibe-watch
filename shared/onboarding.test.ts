import { describe, expect, it } from "vitest";
import { DECK_SIZE, buildOnboardingDeck } from "./onboarding";
import type { MovieSummary } from "./tmdb";

let id = 1;
const film = (p: Partial<MovieSummary>): MovieSummary => ({
  id: id++,
  title: `Film ${id}`,
  overview: "",
  poster_path: "/p.jpg",
  backdrop_path: "/b.jpg",
  vote_average: 7.5,
  vote_count: 10_000,
  genre_ids: [28],
  release_date: "2010-01-01",
  original_language: "en",
  popularity: 50,
  ...p,
});

describe("buildOnboardingDeck", () => {
  const pool = [
    ...Array.from({ length: 30 }, () => film({ original_language: "en", genre_ids: [28, 12] })),
    ...Array.from({ length: 5 }, () => film({ original_language: "hi", genre_ids: [18], vote_count: 3000 })),
    ...Array.from({ length: 5 }, () => film({ original_language: "ta", genre_ids: [28, 53], vote_count: 2000 })),
    ...Array.from({ length: 5 }, () => film({ original_language: "ko", genre_ids: [53], vote_count: 8000 })),
    film({ original_language: "ja", genre_ids: [16], vote_count: 15_000 }),
  ];

  it("builds a full deck of unique films", () => {
    const deck = buildOnboardingDeck([...pool, ...pool], DECK_SIZE, "2026-11-20");
    expect(deck).toHaveLength(DECK_SIZE);
    expect(new Set(deck.map((m) => m.id)).size).toBe(DECK_SIZE);
  });

  it("caps any one language so Indian and world cinema both appear", () => {
    const deck = buildOnboardingDeck(pool, DECK_SIZE, "2026-11-20");
    const count = (l: string) => deck.filter((m) => m.original_language === l).length;
    expect(count("en")).toBeLessThanOrEqual(Math.ceil(DECK_SIZE * 0.35));
    for (const l of ["hi", "ta", "ko", "ja"]) expect(count(l)).toBeGreaterThan(0);
  });

  it("leads with something everyone has heard of", () => {
    const deck = buildOnboardingDeck(pool, DECK_SIZE, "2026-11-20");
    expect(deck[0].vote_count).toBeGreaterThanOrEqual(10_000);
  });

  it("skips unknown, unreleased and poster-less films", () => {
    const deck = buildOnboardingDeck(
      [
        film({ vote_count: 50 }),
        film({ release_date: "2027-05-01" }),
        film({ poster_path: null }),
        film({ release_date: "" }),
        film({}),
      ],
      5,
      "2026-11-20",
    );
    expect(deck).toHaveLength(1);
  });
});
