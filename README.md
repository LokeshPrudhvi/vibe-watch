# vibe. — movie & TV discovery

Mood-first discovery with time-fit, poster-themed pages and India-specific availability.
(`vibe.` is a working name; rename it whenever you like.)

## Run it (dev)

```bash
npm install
cp .env.example .env.local     # paste your TMDB "API Read Access Token" (v4) into TMDB_TOKEN
npm run dev                    # http://localhost:5173
```

The browser never talks to TMDB directly. It calls `/api/tmdb/*`, and the proxy in
`server/tmdbProxy.ts` adds the token server-side. The same proxy runs inside the Vite dev
server, so dev and production behave the same.

## Database & accounts (Neon + Better Auth)

```bash
neon deploy          # links the Neon project in .neon / neon.ts, pulls DATABASE_URL* into .env.local
npm run db:migrate   # creates/updates tables over the DIRECT url (Better Auth's + ours)
node scripts/smoke-accounts.mjs http://localhost:3000   # end-to-end check against a running server
```

- **Postgres:** Neon, reached with `pg` (node-postgres) and one shared pool on the *pooled*
  `DATABASE_URL`, as Neon recommends for a long-running Node server. Migrations are code in
  `server/migrations.ts` and run over `DATABASE_URL_UNPOOLED`. Neon's own Postgres guidance is
  the `neon-postgres` agent skill.
- **Sign-in:** self-hosted [Better Auth](https://better-auth.com) at `/api/auth/*`, users in the
  same database. Web uses an httpOnly cookie; the mobile app sends `Authorization: Bearer <token>`
  (the `bearer()` plugin). Neon's managed auth was skipped because its SDK is browser-only and
  doesn't cover the Expo app.
- **Consent:** asked once on first launch. Nothing is uploaded until the person says yes **and**
  is signed in. Turning sharing off deletes their synced data; deleting the account deletes
  everything (foreign keys cascade).
- **Endpoints:** `GET /api/me`, `PUT /api/me/consent`, `POST /api/me/events` (mark/unmark/signal ops,
  idempotent), `GET /api/me/marks`, `GET /api/me/crowd`, `DELETE /api/me`, and the public
  `POST /api/movies/people` (cast + directors, cached in Postgres).
- **Crowd recs:** item-to-item collaborative filtering over consenting users' Loves/Saves
  (`server/crowd.ts`). A pattern needs `CROWD_MIN_SUPPORT` (default 3) distinct other people, so no
  one's list can be inferred. Live SQL is fine for thousands of users; precompute it nightly beyond that.

## Production

```bash
npm run build      # typecheck → Vite client build (dist/) → compile server (dist-server/)
npm start          # Express on $PORT (default 3000), serves dist/ + /api/tmdb/*
npm test           # Vitest: proxy, server, helpers
```

Or with Docker (runs the tests during the build):

```bash
docker build -t vibe-watch .
docker run -p 3000:3000 -e TMDB_TOKEN=your_token -e TRUST_PROXY=1 vibe-watch
```

Runs anywhere that runs Node 22 or a container: Render, Railway, Fly.io, a VPS.
Point the platform's health check at `/healthz`.

| Env var | Required | Default | Notes |
|---|---|---|---|
| `TMDB_TOKEN` | yes | – | TMDB v4 Read Access Token. Server-only; the server refuses to start without it. |
| `DATABASE_URL` | for accounts | – | Neon pooled URL. Without it the app runs with on-device recs only. |
| `DATABASE_URL_UNPOOLED` | for migrations | – | Neon direct URL, used by `npm run db:migrate`. |
| `BETTER_AUTH_SECRET` | with `DATABASE_URL` | – | `openssl rand -base64 32`. Server refuses to start if the DB is set without it. |
| `BETTER_AUTH_URL` | in production | inferred | Public URL of the app, for auth redirects. |
| `CROWD_MIN_SUPPORT` | no | `3` | Privacy floor for "users like you" patterns. |
| `PORT` | no | `3000` | |
| `TRUST_PROXY` | behind a load balancer | off | Usually `1`. Lets rate limiting see real client IPs. |
| `API_RATE_LIMIT_PER_MINUTE` | no | `300` | Per IP, `/api/*` only. |

What the production server does:

- **Secret stays server-side:** the token is only read in Node; nothing `VITE_`-prefixed, so it can't be bundled.
- **Locked-down proxy:** only `/discover/movie`, `/movie/:id`, `/movie/:id/recommendations`, `/search/movie` and `/trending/movie/{day,week}` are
  forwarded, GET only. Responses are cached in memory for 10 minutes, and identical concurrent
  requests share one upstream call. TMDB errors map to clean JSON codes the UI understands.
- **Headers:** strict CSP (self + TMDB images + Google Fonts + YouTube-nocookie embeds), HSTS,
  nosniff, `frame-ancestors 'none'`, and a referrer policy YouTube embeds accept.
- **Caching:** hashed `assets/*` are `immutable` for a year; `index.html` revalidates on every load. Gzip is on.
- **SPA routing:** deep links like `/title/movie/123` serve the app; missing files return real 404s.
- **Ops:** `/healthz`, per-IP rate limit on `/api`, graceful shutdown on SIGTERM, Docker image runs as a non-root user.

On every deploy, run migrations before starting the new version: `npm run db:migrate`
(or `node dist-server/migrate.js` inside the Docker image).

Before launch, also check:

- **TMDB terms.** The API is free for non-commercial use; a commercial product needs a TMDB
  commercial licence. The footer has the required TMDB and JustWatch attribution text; TMDB also
  asks you to show one of their logos from their branding page.
- **Error tracking.** `ErrorBoundary.componentDidCatch` is the place to hook up Sentry or similar.
- **Multiple instances.** The API cache and rate limiter live in memory, per process. That's fine
  for a single instance; with several, move them to Redis.

## Recommendations

`shared/recommend.ts` (shared with the mobile app). Ranking runs on the device; the server only
supplies cast/crew data and, for signed-in users who share activity, crowd patterns.

1. **Learn:** Love / Save / Seen / Not for me (explicit) plus trailer plays, opens, Shuffle skips and
   mood picks (implicit) are stored as events in localStorage. They fold into signed genre,
   language and decade affinities with a 60-day half-life, so taste can drift. Skips fade in 3 days.
2. **Candidates:** for the current mood and time budget, two pages of mood discover, an
   "acclaimed" query and, once we know you, a query in your top non-English language. Every
   candidate fits the time and is streamable or rentable in India.
3. **Score:** Bayesian-averaged rating, mood fit, personal affinity for genres, language, era and
   the **directors and actors** you keep choosing (weighted by confidence, so cold start leans on
   quality), a **crowd** boost from what our users with your taste loved (server), a collaborative boost from TMDB's "people who liked X also liked"
   lists for your loved and saved titles, a little popularity, minus recent-skip penalties, plus
   a small day-seeded jitter.
4. **Diversify:** MMR re-ranking keeps the list from being ten near-identical films.
5. **Explain:** each pick carries its strongest reason ("Because you liked …", "Your kind of Animation").

Settings → Recommendations shows what the app has learned and can reset it.

## Settings

Themes: Dark / Light / System, Liquid glass, Real refracting glass (SVG displacement
`backdrop-filter` on the floating navbar; Chromium and Android WebView only, so it's disabled
on iOS/Safari/Firefox), Progressive blur, Reduce dynamic blur, Better performance for glass.
Animations: Off / Slow / Normal / Fast (scales every Motion spring and CSS transition).
Settings are stored in localStorage; `public/theme-init.js` applies the theme before first paint.

## Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript + Vite | Fast dev server, you already know React (MERN) |
| Styling | Tailwind CSS v4 (`@theme` tokens) | Design tokens in one CSS file, no config file |
| Motion | `motion` (Framer Motion) | `layoutId` shared-element transitions: poster → detail, nav pill, mood chip |
| Data | TanStack Query | Caching, request cancelling, `keepPreviousData` while sliding |
| Client state | Zustand (persisted) | Mood, time budget, taste affinities survive reloads |
| Routing | React Router v7 | |
| Icons | lucide-react | |
| Server | Express 5 + helmet + compression + express-rate-limit | TMDB proxy (hides the token), static hosting, security headers |
| Tests | Vitest | |
| **Later:** data | MongoDB | Merge OMDb/TVmaze, users, watchlists, Group pick (Socket.io), stats |

## Folder structure

```
server/
  index.ts                 entry: env, listen, graceful shutdown
  app.ts                   Express app: headers, compression, rate limit, static + SPA fallback
  tmdbProxy.ts             /api/tmdb/* allowlisted, cached proxy (also used by the Vite dev server)
src/
  main.tsx                 providers: ErrorBoundary, Query, Router, MotionConfig
  App.tsx                  routes + LayoutGroup (shared-element transitions)
  styles/index.css         design tokens, glass, accent theming, slider
  lib/
    tmdb.ts                typed client for /api/tmdb + ApiError + image/trailer/provider helpers
    moods.ts               mood → genre mapping (the "mood search" engine)
    color.ts               poster → accent colour extraction (canvas)
    recommend.ts           on-device recommender: profile, scoring, collab, MMR, explanations
    refraction.ts          displacement map for the refracting navbar
    motion.ts              animation-speed scaling for Motion transitions
    time.ts                durations, "ends at", day-part
  hooks/                   useTmdb (queries), usePosterAccent, useNow/useDebounced/useScrolled/useDocumentTitle
  store/                   useVibeStore (mood, minutes, taste events), useSettings (themes/motion), useToast
  components/
    layout/                AppShell, PageHeader, BottomNav (split tabs + search), ProgressiveBlur
    home/                  MoodChips, TimeSlider, TonightPick, PosterRow, PosterCard
    ui/                    MatchRing, TrailerModal, Skeleton, ErrorCard, ErrorBoundary, Controls, FeedbackButtons, Toaster
  pages/                   Home (Tonight), Explore, Library, Search, Settings, TitlePreview (detail stub), Placeholder, NotFound
```

Planned additions: `features/detail`, `features/group-pick`, `features/stats`, `lib/omdb.ts`, `lib/tvmaze.ts`.

## What's real vs placeholder on Home

- **Real (TMDB):** mood results (`/discover/movie` with genre OR/exclude rules), time-fit
  (`with_runtime.lte`), India availability filter (`watch_region=IN`), tonight's pick details,
  trailer, provider logos and app count, trending row, poster-derived accent colours.
- **On-device:** recommendations and match % (see above). Watch history from Trakt could feed the same event log later.
- **Placeholder:** the Together tab.
