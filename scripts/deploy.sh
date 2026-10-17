#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Running test suite..."
bun test

echo "==> Building Curio Docker container..."
docker compose build

echo "==> Deploying containerized Curio..."
docker compose up -d curio

echo "==> Awaiting healthy status on http://127.0.0.1:3000/curio/api/health..."
MAX_ATTEMPTS=15
ATTEMPT=0
until curl -sf http://127.0.0.1:3000/curio/api/health >/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "ERROR: Health check timed out after ${MAX_ATTEMPTS} attempts."
    docker logs curio --tail 30
    exit 1
  fi
  sleep 1
done

echo "==> Curio is live and healthy at:"
echo "    Local:     http://127.0.0.1:3000/curio"
echo "    Tailscale: https://mini.orca-banjo.ts.net/curio"
