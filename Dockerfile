FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Install Bun for fast package installation
RUN npm install -g bun@1.4.2

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY . .

# Run Next.js production build (generates .next/standalone)
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ── Runner ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
ENV DATABASE_PATH=/data/curio.db
ENV MEDIA_PATH=/data/media

RUN apk add --no-cache libc6-compat

# Copy standalone build output, native bindings, and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public* ./public/

RUN mkdir -p /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
