import { describe, expect, it } from "vitest";
import { buildCrowd, buildProfile, recommend, scoreMovie, type Mark, type PeopleMap } from "./recommend";
import { MOODS } from "./moods";
import type { MovieSummary } from "./tmdb";

const NOW = Date.UTC(2026, 10, 20);

function movie(id: number, p: Partial<MovieSummary> = {}): MovieSummary {
  return {
    id,
    title: `Film ${id}`,
    overview: "",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    vote_average: 7.4,
    vote_count: 3000,
    genre_ids: [878],
    release_date: "2014-11-05",
    original_language: "en",
    popularity: 40,
    ...p,
  };
}
const like = (m: MovieSummary, at = NOW): Mark => ({
  type: "like",
  at,
  movie: { id: m.id, title: m.title, poster: null, genres: m.genre_ids, lang: "en", year: 2014 },
});

const nolan = { id: 525, name: "Christopher Nolan" };
const villeneuve = { id: 137427, name: "Denis Villeneuve" };
const mcconaughey = { id: 10297, name: "Matthew McConaughey" };

describe("cast & director affinity", () => {
  const interstellar = movie(157336, { title: "Interstellar" });
  const inception = movie(27205, { title: "Inception" });
  const people: PeopleMap = {
    [interstellar.id]: { directors: [nolan], cast: [mcconaughey] },
    [inception.id]: { directors: [nolan], cast: [{ id: 6193, name: "Leonardo DiCaprio" }] },
  };

  it("learns directors and actors from what you love", () => {
    const p = buildProfile([like(interstellar), like(inception)], [], NOW, people);
    expect(p.people?.[nolan.id]).toBe(1); // in both → strongest
    expect(p.people?.[mcconaughey.id]).toBeGreaterThan(0);
    expect(p.peopleNames?.[nolan.id]).toBe("Christopher Nolan");
  });

  it("is a no-op without credits (old callers unchanged)", () => {
    const p = buildProfile([like(interstellar)], [], NOW);
    expect(p.people).toEqual({});
  });

  it("ranks a film by a director you love above an otherwise identical one", () => {
    const loved = Array.from({ length: 4 }, (_, i) => like(movie(900 + i), NOW));
    const lovedPeople: PeopleMap = Object.fromEntries(loved.map((l) => [l.movie.id, { directors: [nolan], cast: [] }]));
    const profile = buildProfile(loved, [], NOW, lovedPeople);

    const tenet = movie(577922, { title: "Tenet" });
    const dune = movie(438631, { title: "Dune" });
    const ctxPeople: PeopleMap = {
      [tenet.id]: { directors: [nolan], cast: [] },
      [dune.id]: { directors: [villeneuve], cast: [] },
    };
    const a = scoreMovie(tenet, { profile, people: ctxPeople, now: NOW });
    const b = scoreMovie(dune, { profile, people: ctxPeople, now: NOW });
    expect(a.score).toBeGreaterThan(b.score + 0.05);
    expect(a.match).toBeGreaterThan(b.match);
    expect(a.reason).toBe("More from Christopher Nolan");
  });

  it("names a favourite actor when there's no director link", () => {
    const loved = Array.from({ length: 4 }, (_, i) => like(movie(800 + i, { genre_ids: [18] }), NOW));
    const lovedPeople: PeopleMap = Object.fromEntries(loved.map((l) => [l.movie.id, { directors: [], cast: [mcconaughey] }]));
    const profile = buildProfile(loved, [], NOW, lovedPeople);
    const target = movie(1, { genre_ids: [10752] }); // a genre you've never touched
    const r = scoreMovie(target, { profile, people: { 1: { directors: [villeneuve], cast: [mcconaughey] } }, now: NOW });
    expect(r.reason).toBe("More with Matthew McConaughey");
  });
});

describe("crowd signal", () => {
  it("normalises server scores and explains with the seed title", () => {
    const crowd = buildCrowd(
      [
        { movieId: 2, score: 1.5, support: 4, because: 1 },
        { movieId: 3, score: 0.5, support: 3, because: 1 },
      ],
      { 1: "Paddington 2" },
    );
    expect(crowd.get(2)?.score).toBe(1);
    expect(crowd.get(3)?.score).toBeCloseTo(1 / 3);

    const profile = buildProfile([], [], NOW);
    const r = scoreMovie(movie(2), { profile, crowd, mood: MOODS.cozy, now: NOW });
    expect(r.reason).toBe("Loved by fans of Paddington 2");
  });

  it("lifts crowd picks in the ranking", () => {
    const profile = buildProfile([], [], NOW);
    const a = movie(10);
    const b = movie(11);
    const crowd = buildCrowd([{ movieId: 11, score: 2, support: 5, because: 99 }], { 99: "Up" });
    const ranked = recommend([a, b], { profile, crowd, now: NOW });
    expect(ranked[0].movie.id).toBe(11);
  });
});

describe("explanations", () => {
  it("doesn't explain a loved film by its own director", () => {
    const coco = movie(354912, { title: "Coco", genre_ids: [16] });
    const unkrich = { id: 8, name: "Lee Unkrich" };
    const people: PeopleMap = { [coco.id]: { directors: [unkrich], cast: [] } };
    const profile = buildProfile([like(coco)], [], NOW, people);
    expect(scoreMovie(coco, { profile, people, now: NOW }).reason).toBe("On your list");
  });
});
