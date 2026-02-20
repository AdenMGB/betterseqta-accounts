# BetterSEQTA Plus – Auth Flow & Token Lifecycle

## Token Types

| Token | Lifetime | Purpose |
|-------|----------|---------|
| **Access token** | 24 hours | Sent as `Authorization: Bearer <token>` for API requests |
| **Refresh token** | 90 days | Used to obtain new access tokens without re-login |

## Flow Diagram

```
┌─────────────────┐     POST /api/bsplus/client/reserve     ┌──────────────┐
│  BetterSEQTA+   │ ──────────────────────────────────────▶│   BS Cloud   │
│  (Extension)    │ ◀────────────────────────────────────── │              │
└────────┬────────┘     { client_id, login_url, ... }       └──────────────┘
         │
         │  POST /api/bsplus/login
         │  { client_id, redirect_uri, login, password }
         ▼
┌─────────────────┐                                        ┌──────────────┐
│  Store tokens   │ ◀───────────────────────────────────── │   BS Cloud   │
│  - access_token │     { access_token, refresh_token,    │              │
│  - refresh_token│       user }                           │              │
│  - user         │                                        └──────────────┘
└────────┬────────┘
         │
         │  API requests: Authorization: Bearer <access_token>
         │
         │  When 401 or token expired:
         │  POST /api/bsplus/refresh
         │  { refresh_token, client_id }
         ▼
┌─────────────────┐                                        ┌──────────────┐
│  Replace tokens │ ◀───────────────────────────────────── │   BS Cloud   │
│  (rolling)      │     { access_token, refresh_token }    │              │
└─────────────────┘                                        └──────────────┘
```

## When to Refresh

1. **Proactive:** Before the access token expires (e.g. when `expires_in` indicates < 5 minutes left).
2. **Reactive:** When any API returns `401 Unauthorized`.

Always replace the stored refresh token with the one returned by the refresh endpoint (rolling sessions).

## Error Handling

| Scenario | Action |
|---------|--------|
| `Invalid credentials` | Show login form again |
| `Invalid client_id or redirect_uri` | Call reserve again to get a new `client_id` |
| `Refresh token expired` | Clear tokens, redirect to login |
| `Invalid refresh_token` | Clear tokens, redirect to login |
| Network error | Retry with exponential backoff; show offline message |

## Client ID Expiration

Reserved client IDs expire after **7 days** of inactivity. Using the client for login, refresh, or config extends the TTL by 7 days. If expired, call `POST /api/bsplus/client/reserve` again to get a new `client_id`. Existing refresh tokens remain valid; only the client_id used for refresh must be valid.

## Security Notes

- Store tokens in `chrome.storage.local` (extension) or secure storage; avoid `localStorage` for sensitive apps.
- Never log or expose refresh tokens.
- Use HTTPS only.
- The `redirect_uri` must exactly match the value used when reserving the client.
