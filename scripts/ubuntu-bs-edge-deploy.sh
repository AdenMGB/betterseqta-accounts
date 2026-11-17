#!/usr/bin/env bash
set -euo pipefail
export HOME=/home/ubuntu
# shellcheck source=/dev/null
. "$HOME/.nvm/nvm.sh"
cd "$HOME/betterseqta-accounts"
pnpm install --frozen-lockfile
pnpm --filter @betterseqta/bs-edge-api build
cd bs-edge-api
if docker ps >/dev/null 2>&1; then DC=docker; else DC="sudo docker"; fi
$DC compose build bs-edge-api
$DC compose up -d
sleep 3
CID=$($DC compose ps -q bs-edge-api)
docker exec "$CID" wget -qO- http://127.0.0.1:8789/api/health
docker exec "$CID" wget -qS -O /dev/null http://127.0.0.1:8789/api/health 2>&1 | head -8
echo DONE