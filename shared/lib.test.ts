import { describe, expect, it } from "vitest";
import { formatDuration, minutesUntil } from "./time";
import { ApiError, availability, certification, isReleased, isRetryable, pickTrailer, releaseLabel, type MovieDetails, type Video } from "./tmdb";

describe("time", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(130)).toBe("2h 10m");
  });

  it("counts minutes to the next occurrence of an hour", () => {
    const now = new Date(2026, 0, 1, 21, 30);
    expect(minutesUntil(23, now)).toBe(90);
    expect(minutesUntil(0, now)).toBe(150);
    expect(minutesUntil(21, now)).toBe(23 * 60 + 30); // already passed → tomorrow
  });
});

describe("tmdb helpers", () => {
  const v = (type: string, official: boolean, site = "YouTube"): Video => ({
    key: `${type}-${official}-${site}`,
    site,
    type,
    official,
    name: "",
  });

  it("prefers official YouTube trailers", () => {
    const pick = pickTrailer({ results: [v("Teaser", true), v("Trailer", false), v("Trailer", true, "Vimeo"), v("Trailer", true)] });
    expect(pick?.key).toBe("Trailer-true-YouTube");
  });

  it("splits and dedupes India providers", () => {
    const p = (id: number, prio: number) => ({ provider_id: id, provider_name: `P${id}`, logo_path: "", display_priority: prio });
    const details = {
      "watch/providers": { results: { IN: { flatrate: [p(1, 2), p(2, 1)], free: [p(1, 2)], rent: [p(3, 0)], buy: [p(3, 0)] } } },
    } as unknown as MovieDetails;
    const { watch, rent } = availability(details);
    expect(watch.map((x) => x.provider_id)).toEqual([2, 1]);
    expect(rent.map((x) => x.provider_id)).toEqual([3]);
  });

  it("retries only transient failures", () => {
    expect(isRetryable(new ApiError(502, "UPSTREAM_ERROR", ""))).toBe(true);
    expect(isRetryable(new ApiError(0, "NETWORK", ""))).toBe(true);
    expect(isRetryable(new ApiError(404, "NOT_FOUND", ""))).toBe(false);
    expect(isRetryable(new ApiError(503, "MISSING_TMDB_TOKEN", ""))).toBe(false);
    expect(isRetryable(new Error("boom"))).toBe(false);
  });
});

describe("release status", () => {
  const now = new Date(2026, 10, 20); // 20 Nov 2026, local time

  it("treats future, missing and not-yet-released titles as unreleased", () => {
    expect(isReleased("2026-12-17", undefined, now)).toBe(false); // Avengers: Doomsday
    expect(isReleased("", undefined, now)).toBe(false);
    expect(isReleased(undefined, undefined, now)).toBe(false);
    expect(isReleased("2026-11-20", undefined, now)).toBe(true); // out today
    expect(isReleased("2017-10-27", undefined, now)).toBe(true);
    expect(isReleased("2017-10-27", "Post Production", now)).toBe(false); // status wins
  });

  it("labels release dates", () => {
    expect(releaseLabel("2026-12-17", now)).toBe("17 Dec");
    expect(releaseLabel("2027-05-01", now)).toBe("1 May 2027");
    expect(releaseLabel(undefined, now)).toBe("TBA");
  });

  it("prefers the India age rating, then US", () => {
    const rd = (results: { iso_3166_1: string; cert: string }[]) =>
      ({
        release_dates: {
          results: results.map((r) => ({ iso_3166_1: r.iso_3166_1, release_dates: [{ certification: r.cert, release_date: "", type: 3 }] })),
        },
      }) as unknown as MovieDetails;
    expect(certification(rd([{ iso_3166_1: "US", cert: "PG-13" }, { iso_3166_1: "IN", cert: "UA" }]))).toEqual({ cert: "UA", region: "IN" });
    expect(certification(rd([{ iso_3166_1: "US", cert: "PG-13" }, { iso_3166_1: "IN", cert: "" }]))).toEqual({ cert: "PG-13", region: "US" });
    expect(certification(rd([]))).toBeUndefined();
  });
});
