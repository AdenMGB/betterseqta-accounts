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

cd bs-edge-api
npm install
npm run build

if docker ps >/dev/null 2>&1; then
  docker compose build bs-edge-api
  docker compose up -d
else
  sudo docker compose build bs-edge-api
  sudo docker compose up -d
fi

sleep 2
CID="$(docker compose ps -q bs-edge-api)"
docker exec "$CID" wget -qO- "http://127.0.0.1:8789/api/health" || curl -fsS "http://127.0.0.1:8789/api/health"
echo ""
echo "bs-edge-api (Docker) up — health answered on container :8789"