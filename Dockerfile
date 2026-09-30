FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source + drizzle migrations
COPY src/ src/
COPY drizzle/ drizzle/
COPY tsconfig.json drizzle.config.ts ./

# Create data dir
RUN mkdir -p /data

ENV DATABASE_PATH=/data/memory.db
ENV MEDIA_PATH=/data/media
ENV PORT=8080

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:8080/api/health || exit 1

CMD ["bun", "run", "src/index.ts"]
