# bs-edge-api (Ubuntu edge)

Offloads high-volume routes from the Cloudflare Worker:

- `GET /api/health` — answered locally (stops health-check Worker invocations when monitors use the edge host)
- `PUT /api/bsplus/settings/sync` — queued in Redis, flushed to the Worker every **5s** (coalesced per session)
- `GET /api/bsplus/timetable-classmates/peers` — short Redis cache, Worker on miss

All other paths are **proxied** to `WORKER_UPSTREAM` (`https://accounts.betterseqta.org`) with the client `Authorization` / `Cookie` headers unchanged.

## Reverse proxy

Zoraxy runs in Docker: the backend must be **`http://bs-edge-api:8789`** on the **`zorazy_default`** network (not `127.0.0.1` or the host LAN IP). See `bs-edge-api/docker-compose.yml`.

## Local / server

```bash
cd bs-edge-api
cp env.example .env
docker compose up -d
pnpm install
pnpm build
pnpm exec pm2 start ecosystem.config.cjs
```

## Worker (optional)

Set `BS_EDGE_API_URL=https://bsapi.adenmgb.com` on the Worker so `accounts.betterseqta.org` forwards the same three routes to the edge (auth headers forwarded; no API keys).