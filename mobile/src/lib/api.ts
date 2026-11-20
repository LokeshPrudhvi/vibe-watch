import { setApiBase } from "@shared/tmdb";

/**
 * Where the TMDB proxy runs. The phone never holds the TMDB token: it calls a proxy that adds it.
 *
 * 1. EXPO_PUBLIC_TMDB_PROXY: full proxy URL, e.g. http://10.0.2.2:5173/api/tmdb to use the
 *    website's dev server from the Android emulator (`npm run dev -- --host` in the project root).
 * 2. EXPO_PUBLIC_API_URL: a deployed copy of the website's Express server; "/api/tmdb" is added.
 * 3. Otherwise the hosted proxy: a Supabase Edge Function (supabase/functions/tmdb), same contract.
 */
const HOSTED_PROXY = "https://ullgydrohepcnribgmqu.supabase.co/functions/v1/tmdb";

function resolveBase() {
  const proxy = process.env.EXPO_PUBLIC_TMDB_PROXY?.trim();
  if (proxy) return proxy;
  const server = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (server) return `${server.replace(/\/+$/, "")}/api/tmdb`;
  return HOSTED_PROXY;
}

export const API_BASE = resolveBase().replace(/\/+$/, "");

setApiBase(API_BASE);
