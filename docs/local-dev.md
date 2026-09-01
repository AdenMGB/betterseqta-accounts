# Local development — betterseqta-accounts

Accounts runs on **http://localhost:8788** alongside bsplus (`8787`) and mail (`8789`).

See also: [bsplus-website docs/local-dev.md](../bsplus-website/docs/local-dev.md) for the full three-service setup.

## Quick start

```bash
# First time / after schema changes
pnpm db:migrate:local

# Terminal 1 — accounts worker + local D1
cd betterseqta-accounts
pnpm cf:dev

# Terminal 2 — Nuxt dev UI (proxies /api → localhost:8788)
pnpm dev
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm cf:dev` | Resolve dev URLs → generate static SPA → `wrangler dev` on `:8788` |
| `pnpm db:migrate:local` | Apply migrations to `.wrangler/d1-local` (run separately) |
| `pnpm db:migrate:remote` | Apply pending migrations to **remote** D1 (`BS_SETTINGS`) — requires Cloudflare auth |
| `pnpm db:seed:test-user` | Idempotent test user in local D1 |
| `pnpm db:seed:test-user --admin --signup-number 100` | Senior admin user with signup rank (needs migration 0019) |
| `pnpm db:seed:test-user --admin --reset` | Delete existing test user by email, then recreate |

Copy `.env.example` → `.env` and set `JWT_SECRET` (or let `pnpm cf:dev` write `.dev.vars` with a local default).

## Environment

Key vars:

- `JWT_SECRET` — required for login/token signing (in `.env` or auto-written to `.dev.vars` by `pnpm cf:dev`)
- `APP_URL=http://localhost:8788` — OAuth redirects
- `NUXT_DEV_API_PROXY=http://localhost:8788` — optional override for `pnpm dev` API proxy
- `DEV_ACCOUNTS_URL`, `DEV_BSPLUS_URL`, `DEV_MAIL_URL` — written to `.env.local` by `scripts/resolve-dev-services.mjs`

## Health check

```bash
curl http://localhost:8788/api/health
# {"ok":true,"service":"accounts"}
```

## Test account defaults

| Field | Value |
|-------|-------|
| Email | `test@betterseqta.local` |
| Username | `testuser` |
| Password | `TestPass123!` |
| Admin level | `3` (senior admin) when seeded with `--admin` |
| Login | http://localhost:8788/login |

## OAuth for bsplus dev

Register an OAuth client in local accounts admin with redirect URI:

```
http://localhost:8787/api/auth/callback
```

Use the client id/secret in bsplus `.env` as `NUXT_OAUTH_CLIENT_ID` / `NUXT_OAUTH_CLIENT_SECRET`.
