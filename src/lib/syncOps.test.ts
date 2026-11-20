import { describe, expect, it } from "vitest";
import { diffTaste, mergeMarks } from "./syncOps";
import { CONFLICTS, addMark } from "../../shared/taste";
import type { Mark, MovieLite, Signal } from "./recommend";

const m = (id: number): MovieLite => ({ id, title: `Film ${id}`, poster: null, genres: [35] });
const T = Date.UTC(2026, 10, 20);

describe("diffTaste", () => {
  it("turns marks, conflicts and resets into ops", () => {
    const a = addMark([], "save", m(1), T);
    const b = addMark(a, "seen", m(1), T + 1); // seen replaces save
    expect(diffTaste({ marks: a, signals: [] }, { marks: b, signals: [] }, T + 2)).toEqual([
      { op: "mark", type: "seen", at: T + 1, movie: m(1) },
      { op: "unmark", type: "save", at: T + 2, movieId: 1 },
    ]);
    expect(diffTaste({ marks: b, signals: [] }, { marks: [], signals: [] }, T + 3)).toEqual([
      { op: "unmark", type: "seen", at: T + 3, movieId: 1 },
    ]);
  });

  it("uploads only new signals, with stable ids", () => {
    const s1: Signal = { type: "open", at: T, id: 5, genres: [35] };
    const s2: Signal = { type: "mood", at: T + 1, genres: [16] };
    const ops = diffTaste({ marks: [], signals: [s1] }, { marks: [], signals: [s2, s1] });
    expect(ops).toEqual([{ op: "signal", type: "mood", at: T + 1, clientId: `mood:${T + 1}:0`, genres: [16] }]);
  });
});

describe("mergeMarks", () => {
  const mk = (type: Mark["type"], id: number, at: number): Mark => ({ type, at, movie: m(id) });

  it("unions devices and keeps the newest copy", () => {
    const merged = mergeMarks([mk("like", 1, T)], [mk("like", 1, T + 5), mk("save", 2, T)], CONFLICTS);
    expect(merged).toEqual([mk("like", 1, T + 5), mk("save", 2, T)]);
  });

  it("lets the newer choice win a conflict across devices", () => {
    // phone said "not for me" after the laptop said "love"
    const merged = mergeMarks([mk("like", 1, T)], [mk("dislike", 1, T + 10)], CONFLICTS);
    expect(merged.map((x) => x.type)).toEqual(["dislike"]);
    // watched later → drops the old "save"
    expect(mergeMarks([mk("save", 3, T)], [mk("seen", 3, T + 1)], CONFLICTS).map((x) => x.type)).toEqual(["seen"]);
  });
});
