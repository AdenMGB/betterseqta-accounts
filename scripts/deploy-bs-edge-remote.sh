#!/usr/bin/env bash
set -euo pipefail
REPO="${REPO:-https://github.com/AdenMGB/betterseqta-accounts.git}"
BRANCH="${BRANCH:-develop}"
APP_DIR="${APP_DIR:-$HOME/betterseqta-accounts}"

if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

corepack enable 2>/dev/null || true
pnpm install --frozen-lockfile
pnpm --filter @betterseqta/bs-edge-api build

cd bs-edge-api
if docker ps >/dev/null 2>&1; then
  docker compose build bs-edge-api
  docker compose up -d
else
  sudo docker compose build bs-edge-api
  sudo docker compose up -d
fi

sleep 2
CID="$(docker compose ps -q bs-edge-api)"
docker exec "$CID" wget -qO- "http://127.0.0.1:8789/api/health"
echo ""
echo "bs-edge-api (Docker) up — /api/health is local (X-Served-By: bs-edge-api)"