import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTmdbProxy, type TmdbProxyOptions } from "./tmdbProxy";

const servers: Server[] = [];
afterEach(() => {
  servers.splice(0).forEach((s) => s.close());
});

async function start(options: Partial<TmdbProxyOptions> & { upstream?: typeof fetch } = {}) {
  const upstream =
    options.upstream ??
    vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ results: [1, 2] }), { status: 200 }));
  const app = express();
  app.use(
    "/api/tmdb",
    createTmdbProxy({ token: "secret-token", fetch: upstream, logger: { warn() {}, error() {} }, ...options }),
  );
  const server = app.listen(0);
  servers.push(server);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/tmdb`;
  return { base, upstream: upstream as ReturnType<typeof vi.fn<typeof fetch>> };
}

describe("tmdb proxy", () => {
  it("forwards allowed routes with the server-side token", async () => {
    const { base, upstream } = await start();
    const res = await fetch(`${base}/discover/movie?with_genres=35&page=1`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [1, 2] });
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");

    const [url, init] = upstream.mock.calls[0];
    expect(String(url)).toBe("https://api.themoviedb.org/3/discover/movie?page=1&with_genres=35");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("never exposes the token to the client", async () => {
    const { base } = await start();
    const res = await fetch(`${base}/trending/movie/week`);
    const text = await res.text();
    expect(text).not.toContain("secret-token");
    expect([...res.headers.values()].join(" ")).not.toContain("secret-token");
  });

  it.each(["/search/person", "/account", "/movie/abc", "/movie/1/account_states", "/../authentication"])(
    "rejects %s without calling TMDB",
    async (path) => {
      const { base, upstream } = await start();
      const res = await fetch(base + path);
      expect(res.status).toBe(404);
      expect(upstream).not.toHaveBeenCalled();
    },
  );

  it.each(["/movie/550/recommendations", "/search/movie?query=dune", "/trending/movie/day"])(
    "allows %s",
    async (path) => {
      const { base } = await start();
      expect((await fetch(base + path)).status).toBe(200);
    },
  );

  it("only allows GET", async () => {
    const { base, upstream } = await start();
    const res = await fetch(`${base}/trending/movie/week`, { method: "POST" });
    expect(res.status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("serves repeat requests from cache, regardless of param order", async () => {
    const { base, upstream } = await start();
    const a = await fetch(`${base}/discover/movie?a=1&b=2`);
    const b = await fetch(`${base}/discover/movie?b=2&a=1`);
    expect(a.headers.get("x-cache")).toBe("MISS");
    expect(b.headers.get("x-cache")).toBe("HIT");
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("shares one upstream call between concurrent identical requests", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const upstream = vi.fn<typeof fetch>(async () => {
      await gate;
      return new Response("{}", { status: 200 });
    });
    const { base } = await start({ upstream });
    const both = Promise.all([fetch(`${base}/movie/42`), fetch(`${base}/movie/42`)]);
    await new Promise((r) => setTimeout(r, 50));
    release();
    const [a, b] = await both;
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("does not cache errors", async () => {
    const upstream = vi.fn<typeof fetch>(async () => new Response("{}", { status: 500 }));
    const { base } = await start({ upstream });
    await fetch(`${base}/movie/1`);
    await fetch(`${base}/movie/1`);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it.each([
    [404, 404, "NOT_FOUND"],
    [401, 502, "UPSTREAM_AUTH"],
    [429, 503, "UPSTREAM_RATE_LIMITED"],
    [500, 502, "UPSTREAM_ERROR"],
  ])("maps upstream %i to %i %s", async (upstreamStatus, status, code) => {
    const upstream = vi.fn<typeof fetch>(async () => new Response("{}", { status: upstreamStatus }));
    const { base } = await start({ upstream });
    const res = await fetch(`${base}/movie/7`);
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
  });

  it("returns 504 when TMDB times out", async () => {
    const upstream = vi.fn<typeof fetch>(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const { base } = await start({ upstream });
    const res = await fetch(`${base}/movie/7`);
    expect(res.status).toBe(504);
    expect((await res.json()).error.code).toBe("UPSTREAM_TIMEOUT");
  });

  it("explains a missing token instead of calling TMDB", async () => {
    const { base, upstream } = await start({ token: undefined });
    const res = await fetch(`${base}/trending/movie/week`);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("MISSING_TMDB_TOKEN");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("evicts the oldest entries past maxEntries", async () => {
    const { base, upstream } = await start({ maxEntries: 2 });
    for (const id of [1, 2, 3]) await fetch(`${base}/movie/${id}`);
    await fetch(`${base}/movie/1`); // evicted → refetched
    expect(upstream).toHaveBeenCalledTimes(4);
  });
});
