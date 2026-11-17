# bs-edge-api (Ubuntu edge)

Offloads high-volume routes from the Cloudflare Worker:

- `GET`/`HEAD` `/api/health` and `/health` — answered locally with `X-Served-By: bs-edge-api` (never proxied to the Worker; point uptime checks at the edge hostname)
- `PUT /api/bsplus/settings/sync` — queued in Redis, flushed to the Worker every **5s** (coalesced per session)
- `GET /api/bsplus/timetable-classmates/peers` — short Redis cache, Worker on miss

All other paths (including **`/`** SPA HTML and static assets) are **proxied** to `WORKER_UPSTREAM` (`https://worker.accounts.betterseqta.org`) with client auth headers unchanged. Responses rewrite `Location` when they point at the worker host. WebSocket upgrades are proxied to the same upstream.

## Production URLs

| Role | URL |
|------|-----|
| Public (Zoraxy) | `https://accounts.betterseqta.org` → `PUBLIC_ORIGIN` |
| Worker upstream | `https://worker.accounts.betterseqta.org` → `WORKER_UPSTREAM` |

See [cutover-accounts-edge.md](./cutover-accounts-edge.md) for DNS and deploy order.

## Reverse proxy

Zoraxy runs in Docker: the backend must be **`http://bs-edge-api:8789`** on the **`zorazy_default`** network (not `127.0.0.1` or the host LAN IP). See `bs-edge-api/docker-compose.yml`.

## Local / server

```bash
cd bs-edge-api
cp env.example .env
docker compose up -d
pnpm install
pnpm build
docker compose build && docker compose up -d
```

## Worker

Set `APP_URL=https://accounts.betterseqta.org` on the Worker (`wrangler.toml` `[vars]`). Do **not** use `BS_EDGE_API_URL` when the edge is the public entrypoint.