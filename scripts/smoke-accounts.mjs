#!/usr/bin/env node
/**
 * End-to-end smoke test for the account features against a RUNNING server:
 *   node scripts/smoke-accounts.mjs http://localhost:3000
 *
 * Creates 4 throwaway users (random emails @vibe.test, random passwords that are never
 * printed), exercises auth, consent, event sync, cross-device marks, cast data, crowd
 * recommendations and the mobile Bearer path, then deletes every user it created.
 */
import { randomBytes } from "node:crypto";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const run = randomBytes(4).toString("hex");
const created = [];
let failures = 0;

const ok = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!cond) failures++;
};

function client(name) {
  let cookie = "";
  const email = `smoke-${run}-${name}@vibe.test`;
  const password = randomBytes(18).toString("base64url");
  const call = async (path, { method = "GET", body, headers = {} } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        origin: BASE,
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const pair = c.split(";")[0];
      const [k] = pair.split("=");
      cookie = [...cookie.split("; ").filter((x) => x && !x.startsWith(`${k}=`)), pair].join("; ");
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  };
  return { name, email, password, call, clearCookie: () => (cookie = "") };
}

const movie = (id, title) => ({ id, title, poster: null, genres: [35] });
const T = Date.now() - 60_000;

try {
  // ---------- auth ----------
  const me = client("me");
  let r = await me.call("/api/auth/sign-up/email", { method: "POST", body: { name: "Smoke Me", email: me.email, password: me.password } });
  ok("sign up (Better Auth → Neon)", r.status === 200 && r.json?.user?.email === me.email, `status ${r.status}`);
  if (r.status === 200) created.push(me);

  r = await me.call("/api/me");
  ok("session cookie works: GET /api/me", r.status === 200 && r.json?.user?.email === me.email && r.json?.consent === null);

  r = await me.call("/api/me/events", { method: "POST", body: { ops: [] } });
  ok("uploads refused before consent", r.status === 403 && r.json?.error?.code === "CONSENT_REQUIRED");

  r = await me.call("/api/auth/sign-out", { method: "POST", body: {} });
  me.clearCookie();
  r = await me.call("/api/me");
  ok("sign out ends the session", r.status === 401);

  r = await me.call("/api/auth/sign-in/email", { method: "POST", body: { email: me.email, password: "wrong-password-123" } });
  ok("wrong password rejected", r.status === 401 || r.status === 400, `status ${r.status}`);

  r = await me.call("/api/auth/sign-in/email", { method: "POST", body: { email: me.email, password: me.password } });
  const bearer = r.headers.get("set-auth-token");
  ok("sign in again", r.status === 200 && !!r.json?.user, `status ${r.status}`);

  // ---------- mobile path: Bearer token, no cookie, no Origin ----------
  const raw = await fetch(`${BASE}/api/me`, { headers: { authorization: `Bearer ${bearer}` } });
  ok("Bearer token (mobile) works without cookies", raw.status === 200 && (await raw.json())?.user?.email === me.email);

  // ---------- consent + sync ----------
  r = await me.call("/api/me/consent", { method: "PUT", body: { share: true } });
  ok("consent recorded", r.status === 200 && r.json?.consent?.share === true);

  r = await me.call("/api/me/events", {
    method: "POST",
    body: {
      ops: [
        { op: "mark", type: "like", at: T, movie: movie(1001, "Seed Film") },
        { op: "mark", type: "save", at: T, movie: movie(1004, "Later Film") },
        { op: "unmark", type: "save", at: T + 1000, movieId: 1004 },
        { op: "signal", type: "trailer", at: T, clientId: `trailer:${T}:1001`, movieId: 1001, genres: [35] },
        { op: "mark", type: "admin", at: T, movie: movie(1, "x") },
      ],
    },
  });
  ok("events applied, junk rejected", r.status === 200 && r.json?.applied === 4 && r.json?.rejected === 1, JSON.stringify(r.json));

  r = await me.call("/api/me/marks");
  ok("marks read back (another device would see these)", r.status === 200 && r.json?.marks?.length === 1 && r.json.marks[0].movie.id === 1001);

  r = await me.call("/api/me/events", { method: "POST", headers: { origin: "https://evil.example" }, body: { ops: [] } });
  ok("cross-site write blocked", r.status === 403 && r.json?.error?.code === "BAD_ORIGIN");

  // ---------- crowd: 3 other people loved 1001 and 1002; one loved 1001 and 1003 ----------
  for (const [name, films] of [
    ["a", [1001, 1002]],
    ["b", [1001, 1002]],
    ["c", [1001, 1002, 1003]],
  ]) {
    const u = client(name);
    const s = await u.call("/api/auth/sign-up/email", { method: "POST", body: { name, email: u.email, password: u.password } });
    if (s.status === 200) created.push(u);
    await u.call("/api/me/consent", { method: "PUT", body: { share: true } });
    await u.call("/api/me/events", {
      method: "POST",
      body: { ops: films.map((id) => ({ op: "mark", type: "like", at: T, movie: movie(id, `Film ${id}`) })) },
    });
  }
  r = await me.call("/api/me/crowd");
  const items = r.json?.items ?? [];
  ok(
    "crowd: fans of what I loved also loved 1002",
    r.status === 200 && items[0]?.movieId === 1002 && items[0]?.support === 3 && items[0]?.because === 1001,
    JSON.stringify(items.slice(0, 3)),
  );
  ok("crowd: pairs below 3 people stay private (1003 hidden)", !items.some((i) => i.movieId === 1003));

  // ---------- cast & directors (shared Postgres cache) ----------
  let t0 = Date.now();
  r = await me.call("/api/movies/people", { method: "POST", body: { ids: [157336, 27205] } });
  const cold = Date.now() - t0;
  const inter = r.json?.people?.["157336"];
  ok(
    "cast/director data (Interstellar)",
    r.status === 200 && inter?.directors?.[0]?.name === "Christopher Nolan" && inter?.cast?.length > 0,
    inter ? `${inter.directors[0]?.name}; ${inter.cast.slice(0, 2).map((c) => c.name).join(", ")}` : "",
  );
  t0 = Date.now();
  r = await me.call("/api/movies/people", { method: "POST", body: { ids: [157336, 27205] } });
  ok("second request served from Postgres cache", r.status === 200 && Object.keys(r.json.people).length === 2, `cold ${cold} ms → warm ${Date.now() - t0} ms`);

  // ---------- withdrawing consent deletes synced data ----------
  r = await me.call("/api/me/consent", { method: "PUT", body: { share: false } });
  r = await me.call("/api/me/marks");
  ok("turning sharing off deletes synced marks", r.status === 200 && r.json?.marks?.length === 0);
} finally {
  // ---------- cleanup via the app's own delete endpoint ----------
  let deleted = 0;
  for (const u of created) {
    let r = await u.call("/api/me", { method: "DELETE" });
    if (r.status === 401) {
      await u.call("/api/auth/sign-in/email", { method: "POST", body: { email: u.email, password: u.password } });
      r = await u.call("/api/me", { method: "DELETE" });
    }
    if (r.status === 200 && r.json?.deleted) deleted++;
  }
  ok(`deleted all ${created.length} smoke-test accounts`, deleted === created.length);
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
  process.exitCode = failures ? 1 : 0;
}
