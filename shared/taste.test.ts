import { describe, expect, it } from "vitest";
import { addMark, addSignal, clampMinutes, hasMark, migrateTaste, removeMark, MAX_SIGNALS, TIME_MAX, TIME_MIN } from "./taste";
import { accentFromPixels, hslCss, hslToHex, FALLBACK_HSL } from "./accent";
import type { MovieLite } from "./recommend";

const film: MovieLite = { id: 7, title: "Film", poster: null, genres: [35] };

describe("taste rules", () => {
  it("replaces conflicting marks on the same title", () => {
    let marks = addMark([], "save", film, 1);
    marks = addMark(marks, "seen", film, 2); // watched → no longer saved
    expect(hasMark(marks, "save", 7)).toBe(false);
    expect(hasMark(marks, "seen", 7)).toBe(true);
    marks = addMark(marks, "dislike", film, 3);
    marks = addMark(marks, "like", film, 4); // love wins over "not for me"
    expect(marks.map((m) => m.type).sort()).toEqual(["like", "seen"]);
    expect(removeMark(marks, "like", 7).map((m) => m.type)).toEqual(["seen"]);
  });

  it("keeps the signal log capped, newest first", () => {
    let signals = addSignal([], "open", film, 1);
    for (let i = 0; i < MAX_SIGNALS + 5; i++) signals = addSignal(signals, "skip", film, i + 2);
    expect(signals).toHaveLength(MAX_SIGNALS);
    expect(signals[0].at).toBe(MAX_SIGNALS + 6);
  });

  it("clamps the time budget and migrates old saves", () => {
    expect(clampMinutes(5)).toBe(TIME_MIN);
    expect(clampMinutes(999)).toBe(TIME_MAX);
    expect(migrateTaste({ mood: "edge", minutes: 90, genres: { 35: 1 } }, 1)).toEqual({
      mood: "edge",
      minutes: 90,
      marks: [],
      signals: [],
    });
  });
});

describe("poster accent", () => {
  const solid = (r: number, g: number, b: number, n = 100) =>
    Array.from({ length: n }, () => [r, g, b, 255]).flat();

  it("finds the vivid colour and keeps it readable", () => {
    const [h, s, l] = accentFromPixels(solid(200, 30, 30));
    expect(h).toBe(0);
    expect(s).toBeGreaterThanOrEqual(0.65);
    expect(l).toBeGreaterThanOrEqual(0.56);
  });

  it("falls back to grey for colourless posters", () => {
    expect(accentFromPixels(solid(120, 120, 120))).toEqual(FALLBACK_HSL);
  });

  it("formats for CSS and for native", () => {
    expect(hslCss(FALLBACK_HSL)).toBe("hsl(0 0% 78%)");
    expect(hslToHex([0, 1, 0.5])).toBe("#ff0000");
    expect(hslToHex([120, 1, 0.25])).toBe("#008000");
  });
});
