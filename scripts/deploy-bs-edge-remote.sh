#!/usr/bin/env bash
set -euo pipefail
REPO="${REPO:-https://github.com/AdenMGB/betterseqta-accounts.git}"
BRANCH="${BRANCH:-develop}"
APP_DIR="${APP_DIR:-$HOME/betterseqta-accounts}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

corepack enable
pnpm install --filter @betterseqta/bs-edge-api...
pnpm --filter @betterseqta/bs-edge-api build

cd bs-edge-api
docker compose up -d

pnpm exec pm2 delete bs-edge-api 2>/dev/null || true
pnpm exec pm2 start ecosystem.config.cjs
pnpm exec pm2 save

echo "bs-edge-api running on port ${PORT:-8789} (set in bs-edge-api/.env)"