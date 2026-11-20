# vibe. for Android and iOS

React Native + Expo (SDK 58, React Native 0.88, new architecture) version of the vibe. web app.
Same features as the website: Tonight's pick with mood + time-fit, Explore rows, Search with
language filters, Library shelves, Settings, and the title detail screen.

## What's shared with the website

Everything that isn't UI lives in `../shared/` and is used by both apps unchanged:

| File | What it does |
|---|---|
| `shared/tmdb.ts` | Typed TMDB client (talks to the Express proxy), providers, trailers, release dates, age ratings |
| `shared/recommend.ts` | On-device recommender: taste profile, scoring, collaborative signal, MMR diversity, reasons |
| `shared/taste.ts` | Rules for Love / Save / Seen / Not for me, signals, time budget, store migration |
| `shared/moods.ts` | Mood → TMDB genre rules |
| `shared/languages.ts`, `shared/time.ts` | Language chips and names, "ends at", day part |
| `shared/accent.ts` | Poster → accent colour maths |

`shared/` must stay free of npm imports and of browser/Node APIs: Metro bundles it into the app.
Its tests run with the website's `npm test`.

The phone never holds the TMDB token. Like the website, it calls the Express proxy at `/api/tmdb/*`.

## Stack

| Need | Library |
|---|---|
| Animations off the JS thread | Reanimated 4 + Gesture Handler 3 (time slider, navbar morph, pills, match ring) |
| Long poster rows and grids | FlashList 2 (recycled cells) |
| Posters | expo-image, memory + disk cache, smallest TMDB size that's sharp on the screen (capped at 2.5×) |
| Glass | iOS 26+: system Liquid Glass (`expo-glass-effect`); older iOS: native blur; Android 12+: RenderEffect blur via `expo-blur`'s `BlurTargetView` |
| Poster accent colour | Skia decodes a w92 poster; colour maths from `shared/accent.ts` |
| Data and state | TanStack Query + Zustand, persisted in MMKV |
| Keyboard | react-native-keyboard-controller (navbar rides on top of the keyboard while searching) |
| Navigation | Expo Router: native stack for detail/settings, tabs with a custom floating navbar |

Performance rules this app follows:

- Every animation runs on the UI thread. React only hears about the time slider when it crosses a 5-minute step.
- Live blur only on the small floating navbar. The big backdrops are tiny (w300) images blurred once while decoding.
- "Better performance for glass" is on by default on phones with under 4 GB of RAM or Android below 12.
- Skia is loaded lazily, only the two display font weights ship, and lucide icons are imported one file at a time.

## Where movies come from

The phone never holds the TMDB token. It calls a proxy that adds it, with the same contract as the
website's `/api/tmdb/*`:

1. `EXPO_PUBLIC_TMDB_PROXY`, a full proxy URL, if set (for example `http://10.0.2.2:5173/api/tmdb`
   to use the website's dev server from the Android emulator after `npm run dev -- --host`).
2. `EXPO_PUBLIC_API_URL`, a deployed copy of the website's Express server (`/api/tmdb` is added).
3. Otherwise the hosted proxy: the Supabase Edge Function in `../supabase/functions/tmdb`
   (project `vibe-watch`). Redeploy it with
   `supabase functions deploy tmdb --project-ref ullgydrohepcnribgmqu --no-verify-jwt --use-api`.

## Get the APK

Every tag `v*` pushed to GitHub builds a release APK in GitHub Actions
(`.github/workflows/android-apk.yml`) and attaches it to that GitHub Release under **Assets**.
You can also run the workflow by hand from the Actions tab. The APK is signed with the
development key, so it installs on any phone (allow "Install unknown apps"), but it isn't
Play Store ready: that needs your own upload key or EAS Build.

## Run it in development

MMKV, Skia and the keyboard controller have native code, so this needs a development build, not Expo Go.

```bash
npm install
npm run android
```

A local Android build needs the Android SDK (`ANDROID_HOME`), a JDK 17+ and roughly 6 GB of free disk.
iOS builds need Xcode on a Mac (`npm run ios`) or EAS Build in the cloud (`npx eas-cli@latest build`).

## Checks

```bash
npm run typecheck
npm run lint
npm run doctor
```

## Not built yet

- Real refraction of what scrolls under the navbar (planned as Android 13+ only, with a Skia runtime shader).
- Shared-element poster → detail animation (the detail screen uses the native slide transition).
- Accounts and sync with the server's `/api/me/*` endpoints, and the people/crowd signals now in `shared/recommend.ts`.
- App icon and splash artwork (still Expo's placeholders).
