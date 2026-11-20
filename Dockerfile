# syntax=docker/dockerfile:1

# ---- build: install everything, typecheck, test, bundle client + compile server ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build && npm prune --omit=dev

# ---- runtime: only production deps + build output, runs as non-root ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" > /dev/null || exit 1
# TMDB_TOKEN must be provided at runtime: docker run -e TMDB_TOKEN=... -p 3000:3000 vibe-watch
CMD ["node", "dist-server/index.js"]
