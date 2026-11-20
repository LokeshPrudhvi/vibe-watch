import { describe, expect, it } from "vitest";
import {
  bayesianRating,
  buildCollab,
  buildProfile,
  diversify,
  recommend,
  scoreMovie,
  type Mark,
  type MovieLite,
  type Signal,
} from "./recommend";
import { MOODS } from "./moods";
import type { MovieSummary } from "./tmdb";

const NOW = Date.UTC(2026, 10, 20);
const DAY = 86_400_000;

let nextId = 1;
function movie(p: Partial<MovieSummary> = {}): MovieSummary {
  return {
    id: nextId++,
    title: "Film",
    overview: "",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    vote_average: 7.2,
    vote_count: 2000,
    genre_ids: [35],
    release_date: "2019-05-01",
    original_language: "en",
    popularity: 40,
    ...p,
  };
}

const lite = (m: MovieSummary): MovieLite => ({
  id: m.id,
  title: m.title,
  poster: m.poster_path,
  genres: m.genre_ids,
  lang: m.original_language,
  year: Number(m.release_date.slice(0, 4)),
});
const mark = (type: Mark["type"], m: MovieSummary, daysAgo = 0): Mark => ({ type, at: NOW - daysAgo * DAY, movie: lite(m) });
const signal = (type: Signal["type"], m: MovieSummary, daysAgo = 0): Signal => ({
  type,
  at: NOW - daysAgo * DAY,
  id: m.id,
  genres: m.genre_ids,
  lang: m.original_language,
});

describe("buildProfile", () => {
  it("starts with zero confidence and no opinions", () => {
    const p = buildProfile([], [], NOW);
    expect(p.confidence).toBe(0);
    expect(p.genres).toEqual({});
  });

  it("learns liked and disliked genres", () => {
    const horror = movie({ genre_ids: [27] });
    const comedy = movie({ genre_ids: [35] });
    const p = buildProfile([mark("like", comedy), mark("dislike", horror)], [], NOW);
    expect(p.genres[35]).toBeGreaterThan(0);
    expect(p.genres[27]).toBeLessThan(0);
    expect(p.hidden.has(horror.id)).toBe(true);
    expect(p.seeds.map((s) => s.id)).toEqual([comedy.id]);
  });

  it("lets old taste fade", () => {
    const old = movie({ genre_ids: [27] });
    const recent = movie({ genre_ids: [35] });
    const p = buildProfile([mark("like", old, 365), mark("like", recent, 1)], [], NOW);
    expect(p.genres[35]).toBeGreaterThan(p.genres[27] * 10);
  });

  it("gains confidence with more evidence", () => {
    const one = buildProfile([mark("like", movie())], [], NOW).confidence;
    const many = buildProfile(Array.from({ length: 6 }, () => mark("like", movie())), [], NOW).confidence;
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThanOrEqual(1);
  });

  it("forgets skips after a few days", () => {
    const m = movie();
    const fresh = buildProfile([], [signal("skip", m, 0)], NOW).skips[m.id];
    const stale = buildProfile([], [signal("skip", m, 14)], NOW).skips[m.id];
    expect(fresh).toBeCloseTo(1);
    expect(stale).toBeLessThan(0.05);
  });
});

describe("scoreMovie", () => {
  const mood = MOODS.cozy;

  it("prefers well-rated films with enough votes", () => {
    const p = buildProfile([], [], NOW);
    const great = scoreMovie(movie({ vote_average: 8.4, vote_count: 9000 }), { profile: p, mood, now: NOW });
    const shaky = scoreMovie(movie({ vote_average: 9.5, vote_count: 12 }), { profile: p, mood, now: NOW });
    expect(great.score).toBeGreaterThan(shaky.score);
    expect(bayesianRating(9.5, 12)).toBeLessThan(7);
  });

  it("personalises toward liked genres", () => {
    const liked = movie({ genre_ids: [16] });
    const p = buildProfile(Array.from({ length: 4 }, () => mark("like", movie({ genre_ids: [16] }))), [], NOW);
    const animation = scoreMovie(movie({ genre_ids: [16] }), { profile: p, mood, now: NOW });
    const romance = scoreMovie(movie({ genre_ids: [10749] }), { profile: p, mood, now: NOW });
    expect(animation.score).toBeGreaterThan(romance.score);
    expect(animation.match).toBeGreaterThan(romance.match);
    expect(animation.reason).toBe("Your kind of Animation");
    expect(liked).toBeTruthy();
  });

  it("explains collaborative picks with the seed title", () => {
    const seed = movie({ title: "Paddington 2" });
    const target = movie();
    const p = buildProfile([mark("like", seed)], [], NOW);
    const collab = buildCollab(p.seeds, [[target]]);
    const r = scoreMovie(target, { profile: p, mood, collab, now: NOW });
    expect(r.reason).toBe("Because you liked Paddington 2");
  });

  it("keeps match within 40–99", () => {
    const p = buildProfile([], [], NOW);
    for (const v of [0, 5, 10]) {
      const { match } = scoreMovie(movie({ vote_average: v, vote_count: 50_000 }), { profile: p, mood, now: NOW });
      expect(match).toBeGreaterThanOrEqual(40);
      expect(match).toBeLessThanOrEqual(99);
    }
  });

  it("pushes a skipped title down", () => {
    const a = movie({ vote_average: 8 });
    const p0 = buildProfile([], [], NOW);
    const p1 = buildProfile([], [signal("skip", a)], NOW);
    expect(scoreMovie(a, { profile: p1, mood, now: NOW }).score).toBeLessThan(
      scoreMovie(a, { profile: p0, mood, now: NOW }).score - 0.2,
    );
  });
});

describe("recommend", () => {
  it("never returns hidden, poster-less or duplicate titles", () => {
    const seen = movie();
    const noPoster = movie({ poster_path: null });
    const ok = movie();
    const p = buildProfile([mark("seen", seen)], [], NOW);
    const out = recommend([seen, noPoster, ok, ok], { profile: p, mood: MOODS.cozy, now: NOW });
    expect(out.map((r) => r.movie.id)).toEqual([ok.id]);
  });

  it("diversifies near-duplicates apart", () => {
    const p = buildProfile([], [], NOW);
    const same = Array.from({ length: 4 }, () => movie({ genre_ids: [35, 10749], vote_average: 7.6 }));
    const different = movie({ genre_ids: [16, 10751], vote_average: 7.3, original_language: "ja", release_date: "1988-01-01" });
    const ranked = diversify(
      [...same, different].map((m) => scoreMovie(m, { profile: p, mood: MOODS.cozy, now: NOW })),
    );
    const pos = ranked.findIndex((r) => r.movie.id === different.id);
    expect(pos).toBeLessThanOrEqual(2); // pulled up ahead of the look-alikes
  });
});
