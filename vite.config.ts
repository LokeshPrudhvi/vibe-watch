import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { createApi } from "./server/api";
import { createServices, type ServiceEnv } from "./server/services";

/**
 * Mounts the same /api app the production server uses (TMDB proxy, Better Auth, account
 * sync, cast data, crowd recs), so secrets stay server-side in dev too and the phone app can
 * keep calling `${origin}/api/tmdb/...` against `npm run dev -- --host`.
 */
function vibeApi(env: ServiceEnv): Plugin {
  let api: ReturnType<typeof createApi> | undefined;
  const lazy = () => {
    if (!api) {
      const services = createServices(env);
      console.log(`  vibe api  ${services.describe}`);
      api = createApi(services);
    }
    return api;
  };
  return {
    name: "vibe-api",
    configureServer(server) {
      if (process.env.VITEST) return; // tests build their own app
      server.middlewares.use((req, res, next) => (req.url?.startsWith("/api/") ? lazy()(req, res, next) : next()));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => (req.url?.startsWith("/api/") ? lazy()(req, res, next) : next()));
    },
  };
}

export default defineConfig(({ mode }) => {
  // "" prefix → also loads non-VITE_ vars; they stay in Node and are never bundled.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env } as ServiceEnv;

  return {
    plugins: [react(), tailwindcss(), vibeApi(env)],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    build: {
      rollupOptions: {
        output: {
          // Libraries change far less often than app code → separate long-cached chunks.
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler|cookie|set-cookie-parser)[\\/]/.test(id)) return "react";
            if (/[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "motion";
            return "vendor";
          },
        },
      },
    },
  };
});
