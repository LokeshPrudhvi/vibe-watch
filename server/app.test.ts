import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";

let server: Server;
let base: string;
let distDir: string;

beforeAll(async () => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-dist-"));
  fs.mkdirSync(path.join(distDir, "assets"));
  fs.writeFileSync(path.join(distDir, "index.html"), "<!doctype html><div id=root></div>");
  fs.writeFileSync(path.join(distDir, "assets", "index-abc123.js"), "console.log(1)");
  fs.writeFileSync(path.join(distDir, "favicon.svg"), "<svg/>");

  const app = createApp({
    distDir,
    tmdb: { token: "t", fetch: async () => new Response("{}", { status: 200 }) },
    apiRateLimitPerMinute: 5,
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  fs.rmSync(distDir, { recursive: true, force: true });
});

describe("production server", () => {
  it("serves index.html for client-side routes, uncached", async () => {
    for (const route of ["/", "/stats", "/title/movie/123"]) {
      const res = await fetch(base + route);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('id=root');
      expect(res.headers.get("cache-control")).toBe("no-cache");
    }
  });

  it("caches hashed assets for a year", async () => {
    const res = await fetch(`${base}/assets/index-abc123.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("revalidates non-hashed public files", async () => {
    const res = await fetch(`${base}/favicon.svg`);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("404s missing files instead of returning index.html", async () => {
    const res = await fetch(`${base}/assets/gone-123.js`);
    expect(res.status).toBe(404);
  });

  it("404s unknown API routes as JSON", async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("sends security headers", async () => {
    const res = await fetch(base + "/");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("answers health checks", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rate-limits the API per client", async () => {
    // limit is 5/min; the 404 test above already used one
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await fetch(`${base}/api/tmdb/trending/movie/week`)).status);
    expect(statuses).toContain(429);
    const last = await fetch(`${base}/api/tmdb/trending/movie/week`);
    expect((await last.json()).error.code).toBe("RATE_LIMITED");
  });
});
