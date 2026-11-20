import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "./db";
import { explicitSsl } from "./db";
import { migrateApp } from "./migrations";
import { applyOps, getConsent, getMarks, parseOps, setConsent, type SyncOp } from "./sync";
import { crowdRecommendations } from "./crowd";
import { createPeopleService, parseCredits } from "./people";
import { createApi } from "./api";

let pg: PGlite;
let db: Db;
const day = 86_400_000;
const T0 = Date.UTC(2026, 10, 1);

const movie = (id: number, genres = [35]) => ({ id, title: `Film ${id}`, poster: `/p${id}.jpg`, genres });
const mark = (type: "like" | "save" | "seen" | "dislike", id: number, at = T0): SyncOp => ({ op: "mark", type, at, movie: movie(id) });

beforeAll(async () => {
  pg = new PGlite();
  db = pg as unknown as Db;
  // Better Auth owns "user" in production; a stub is enough for our foreign keys.
  await db.query(`create table "user" (id text primary key)`);
  expect(await migrateApp(db)).toEqual(["001_taste_sync"]);
  expect(await migrateApp(db)).toEqual([]); // idempotent
});

afterAll(() => pg.close());

beforeEach(async () => {
  await db.query(`delete from "user"`);
  await db.query(`delete from movie_people`);
});

async function user(id: string, share = true) {
  await db.query(`insert into "user" (id) values ($1)`, [id]);
  await setConsent(db, id, share);
}

describe("sync", () => {
  it("applies marks idempotently and keeps the newest", async () => {
    await user("u1");
    await applyOps(db, "u1", [mark("like", 10, T0), mark("like", 10, T0)]);
    await applyOps(db, "u1", [mark("like", 10, T0 - day)]); // older: ignored
    const marks = await getMarks(db, "u1");
    expect(marks).toHaveLength(1);
    expect(marks[0].at).toBe(T0);
  });

  it("only unmarks if the unmark is not older than the mark", async () => {
    await user("u1");
    await applyOps(db, "u1", [mark("save", 10, T0)]);
    await applyOps(db, "u1", [{ op: "unmark", type: "save", movieId: 10, at: T0 - day }]); // stale
    expect(await getMarks(db, "u1")).toHaveLength(1);
    await applyOps(db, "u1", [{ op: "unmark", type: "save", movieId: 10, at: T0 + day }]);
    expect(await getMarks(db, "u1")).toHaveLength(0);
  });

  it("dedupes signals by clientId", async () => {
    await user("u1");
    const s: SyncOp = { op: "signal", type: "trailer", at: T0, clientId: "trailer:1:10", movieId: 10, genres: [35] };
    await applyOps(db, "u1", [s, s]);
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from user_signal where user_id = 'u1'`);
    expect(rows[0].n).toBe(1);
  });

  it("deletes synced activity when sharing is turned off", async () => {
    await user("u1");
    await applyOps(db, "u1", [mark("like", 10)]);
    await setConsent(db, "u1", false);
    expect(await getMarks(db, "u1")).toEqual([]);
    expect((await getConsent(db, "u1"))?.share).toBe(false);
  });

  it("cascades everything when the account is deleted", async () => {
    await user("u1");
    await applyOps(db, "u1", [mark("like", 10)]);
    await db.query(`delete from "user" where id = 'u1'`);
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from user_mark`);
    expect(rows[0].n).toBe(0);
  });

  it("validates uploads strictly", () => {
    const parsed = parseOps({
      ops: [
        mark("like", 10),
        { op: "mark", type: "like", at: T0, movie: { id: -1, title: "x", genres: [] } },
        { op: "mark", type: "admin", at: T0, movie: movie(1) },
        { op: "signal", type: "open", at: T0 }, // no clientId
        { op: "unmark", type: "seen", at: Date.now() + 10 * day, movieId: 5 }, // from the future
      ],
    });
    expect("ops" in parsed && parsed.ops).toHaveLength(1);
    expect("rejected" in parsed && parsed.rejected).toBe(4);
    expect(parseOps({ ops: Array(201).fill(mark("like", 1)) })).toHaveProperty("error");
  });
});

describe("crowd recommendations", () => {
  it("finds what people with the same taste loved", async () => {
    await user("me");
    for (const u of ["a", "b", "c"]) {
      await user(u);
      await applyOps(db, u, [mark("like", 1), mark("save", 2)]); // 3 people: loved 1 and 2
    }
    await user("d");
    await applyOps(db, "d", [mark("like", 1), mark("like", 3)]); // only 1 person: 1 and 3
    await applyOps(db, "me", [mark("like", 1)]);

    const recs = await crowdRecommendations(db, "me", { minSupport: 3 });
    expect(recs.map((r) => r.movieId)).toEqual([2]); // 3 is below the privacy threshold
    expect(recs[0]).toMatchObject({ support: 3, because: 1 });
    expect(recs[0].score).toBeGreaterThan(0);
  });

  it("ignores people who don't share, and things I already marked", async () => {
    await user("me");
    for (const u of ["a", "b", "c"]) {
      await user(u, false); // not sharing
      await db.query(
        `insert into user_mark (user_id, movie_id, type, marked_at, movie) values ($1, 1, 'like', now(), '{}'), ($1, 2, 'like', now(), '{}')`,
        [u],
      );
    }
    await applyOps(db, "me", [mark("like", 1)]);
    expect(await crowdRecommendations(db, "me", { minSupport: 1 })).toEqual([]);

    for (const u of ["x", "y", "z"]) {
      await user(u);
      await applyOps(db, u, [mark("like", 1), mark("like", 2)]);
    }
    expect((await crowdRecommendations(db, "me", { minSupport: 3 })).map((r) => r.movieId)).toEqual([2]);
    await applyOps(db, "me", [mark("seen", 2)]);
    expect(await crowdRecommendations(db, "me", { minSupport: 3 })).toEqual([]);
  });
});

describe("people", () => {
  const credits = {
    cast: [
      { id: 2, name: "Second", order: 1 },
      { id: 1, name: "Lead", order: 0 },
    ],
    crew: [
      { id: 9, name: "Director Person", job: "Director" },
      { id: 8, name: "Someone", job: "Producer" },
    ],
  };

  it("keeps directors and billing order", () => {
    expect(parseCredits(credits)).toEqual({
      directors: [{ id: 9, name: "Director Person" }],
      cast: [
        { id: 1, name: "Lead" },
        { id: 2, name: "Second" },
      ],
    });
  });

  it("fetches each movie once and serves the rest from Postgres", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(credits)));
    const svc = createPeopleService({ token: "t", db, fetch: fetchSpy });
    const first = await svc.get([7, 7, 8, -3]);
    expect(Object.keys(first).sort()).toEqual(["7", "8"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await svc.get([7, 8]);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // cache hit
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/movie/7/credits");
  });
});

describe("api guards (no database configured)", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(
      createApi({
        tmdb: { token: "t", fetch: async () => new Response("{}") },
        people: createPeopleService({ token: "t", fetch: async () => new Response(JSON.stringify({ cast: [], crew: [] })) }),
      }),
    );
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("reports accounts as disabled instead of crashing", async () => {
    for (const path of ["/api/me", "/api/auth/get-session"]) {
      const res = await fetch(base + path);
      expect(res.status).toBe(503);
      expect((await res.json()).error.code).toBe("ACCOUNTS_DISABLED");
    }
  });

  it("still serves TMDB and cast data", async () => {
    expect((await fetch(`${base}/api/tmdb/trending/movie/week`)).status).toBe(200);
    const res = await fetch(`${base}/api/movies/people`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [1] }),
    });
    expect(res.status).toBe(200);
  });

  it("blocks cross-site writes", async () => {
    const res = await fetch(`${base}/api/movies/people`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ ids: [1] }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await fetch(`${base}/api/movies/people`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{nope",
    });
    expect(res.status).toBe(400);
  });
});

describe("explicitSsl", () => {
  it("pins Neon's sslmode=require to verify-full", () => {
    expect(explicitSsl("postgresql://u:p@h/db?sslmode=require&channel_binding=require")).toContain("sslmode=verify-full");
    expect(explicitSsl("postgresql://u:p@h/db")).toBe("postgresql://u:p@h/db");
  });
});
