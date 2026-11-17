# Cutover: `accounts.betterseqta.org` → Ubuntu edge

Public traffic uses **`https://accounts.betterseqta.org`** (Zoraxy → `bs-edge-api:8789`). The Worker and SPA assets live at **`https://worker.accounts.betterseqta.org`**.

## Topology

```text
Client
  → accounts.betterseqta.org (Oracle / Zoraxy TLS)
  → bs-edge-api (hot routes + cache + WS proxy)
  → worker.accounts.betterseqta.org (Cloudflare Worker + ASSETS)
```

## 1. Repository / Worker (before DNS)

1. `wrangler.toml`: route `worker.accounts.betterseqta.org`; `APP_URL=https://accounts.betterseqta.org`.
2. `wrangler deploy` so the Worker binds the **worker** hostname.
3. In Cloudflare, add custom domain **`worker.accounts.betterseqta.org`** for the `betterseqta-account` Worker (if not auto-created).
4. Do **not** set `BS_EDGE_API_URL` on the Worker after cutover (edge is in front; avoids double-hop).
5. Remove or disable the old `accounts.betterseqta.org` Worker custom domain when DNS moves to Ubuntu.

## 2. Ubuntu `bs-edge-api/.env`

```env
PUBLIC_ORIGIN=https://accounts.betterseqta.org
WORKER_UPSTREAM=https://worker.accounts.betterseqta.org
REDIS_URL=redis://redis:6379
```

Then: `pnpm build` (or `npm run build`), `docker compose build && docker compose up -d`.

## 3. Zoraxy

| Host | Backend |
|------|---------|
| `accounts.betterseqta.org` | `http://bs-edge-api:8789` (HTTP, `zorazy_default` network) |

Keep `bsapi.adenmgb.com` as a staging mirror if useful.

## 4. DNS (when ready)

| Name | Target |
|------|--------|
| `accounts.betterseqta.org` | Oracle public IP with Cloudflare proxy **off (grey cloud)** — required so other Workers (e.g. `bs-website`) reach Zoraxy directly instead of looping on CF |
| `worker.accounts.betterseqta.org` | Cloudflare Worker (proxied **on**) |

Remove the legacy **`accounts.betterseqta.org` Worker custom domain** in the Cloudflare dashboard if it still exists (`curl https://accounts.betterseqta.org/cdn-cgi/trace` must **not** show `h=worker.accounts...`).

## 5. Smoke tests

```bash
curl -sS https://accounts.betterseqta.org/api/health
curl -sS -o /dev/null -w "%{http_code}\n" https://accounts.betterseqta.org/
curl -sS https://worker.accounts.betterseqta.org/api/health
```

- `/` should return SPA HTML (proxied from Worker assets).
- Cookies and OAuth redirects should use `accounts.betterseqta.org` (`APP_URL` on Worker).
- Timetable relay: `wss://accounts.betterseqta.org/api/bsplus/timetable-classmates/relay/ws` (edge WS proxy).

## 6. `betterseqta.org` (bs-website) server-side API

Browsers and redirects should use **`https://accounts.betterseqta.org`**.

Prefer **`https://accounts.betterseqta.org`** for server-side OAuth too when DNS is grey-cloud (Ubuntu edge absorbs redirects). If a CF subrequest still loops, `bs-website` falls back to **`worker.accounts.betterseqta.org`** with **`X-Forwarded-Host: accounts.betterseqta.org`**.

## 7. Rollback

Point `accounts.betterseqta.org` DNS back to Cloudflare Worker custom domain and restore `wrangler.toml` route to `accounts.betterseqta.org`.