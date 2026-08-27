# ─── Stage 1: build web (Vite → static files) ──────────────────────────────
FROM node:22-alpine AS web-builder
WORKDIR /work
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY ops-dashboard/package.json ./ops-dashboard/
COPY ops-dashboard/web/package.json ./ops-dashboard/web/
RUN pnpm install --frozen-lockfile --filter ops-dashboard-web...
COPY ops-dashboard/web ./ops-dashboard/web
RUN pnpm --filter ops-dashboard-web build

# ─── Stage 2: build server (esbuild → single CJS bundle) ──────────────────
FROM node:22-alpine AS server-builder
WORKDIR /work
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY ops-dashboard/package.json ./ops-dashboard/
RUN pnpm install --frozen-lockfile --filter ops-dashboard... --prod=false
COPY ops-dashboard ./ops-dashboard
RUN pnpm --filter ops-dashboard build

# ─── Stage 3: runtime ──────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY ops-dashboard/package.json ./ops-dashboard/
RUN pnpm install --frozen-lockfile --filter ops-dashboard... --prod

COPY --from=server-builder /work/ops-dashboard/dist ./ops-dashboard/dist
COPY --from=web-builder /work/ops-dashboard/web/dist ./ops-dashboard/web/dist

WORKDIR /app/ops-dashboard
EXPOSE 2027
CMD ["node", "dist/bundle.cjs"]