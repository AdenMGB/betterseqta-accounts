# BetterSEQTA Plus – API Reference

Base URL: `https://accounts.betterseqta.org`

## 1. Reserve Client ID

**Endpoint:** `POST /api/bsplus/client/reserve`  
**Auth:** None required.

Reserve a unique `client_id` for this app instance. Call once on startup (or when `client_id` is missing). Reuses the same backend as DesQTA; client IDs expire after 7 days of inactivity.

### Request

```json
{
  "redirect_uri": "https://accounts.betterseqta.org/auth/bsplus/callback"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| redirect_uri | string | No | Default: `https://accounts.betterseqta.org/auth/bsplus/callback`. Must match the URI used for login and Discord OAuth. For Chrome extensions, use `chrome-extension://<extension-id>/auth/callback`. |

### Response

```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "redirect_uri": "https://accounts.betterseqta.org/auth/bsplus/callback",
  "api_url": "https://accounts.betterseqta.org",
  "config_url": "https://accounts.betterseqta.org/api/bsplus/config",
  "refresh_url": "https://accounts.betterseqta.org/api/bsplus/refresh",
  "login_url": "https://accounts.betterseqta.org/api/bsplus/login",
  "discord_auth_url": "https://accounts.betterseqta.org/api/oauth/bsplus/discord"
}
```

---

## 2. Get Config

**Endpoint:** `GET /api/bsplus/config?client_id=<client_id>`  
**Auth:** None required.

Returns API URLs for the given client. Use to avoid hardcoding base URLs. Touches the client to extend its 7-day TTL.

### Response

```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_url": "https://accounts.betterseqta.org",
  "refresh_url": "https://accounts.betterseqta.org/api/bsplus/refresh",
  "login_url": "https://accounts.betterseqta.org/api/bsplus/login",
  "discord_auth_url": "https://accounts.betterseqta.org/api/oauth/bsplus/discord"
}
```

---

## 3. Login (Email/Username + Password)

**Endpoint:** `POST /api/bsplus/login`  
**Auth:** None required.

Authenticate with email or username and password. Returns an access token, refresh token, and user object.

### Request

```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "redirect_uri": "https://accounts.betterseqta.org/auth/bsplus/callback",
  "login": "user@example.com",
  "password": "your-password"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| client_id | string | Yes | From reserve or admin OAuth client |
| redirect_uri | string | Yes | Must match the URI used when reserving |
| login | string | Yes | Email or username |
| password | string | Yes | User password |

### Response (200)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "session_id:secret_base64",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "displayName": "Display Name",
    "pfpUrl": "https://...",
    "admin_level": 0
  }
}
```

| Field | Description |
|-------|-------------|
| access_token | JWT, 24h expiry. Use as `Authorization: Bearer <token>` |
| refresh_token | Format `session_id:secret`. Store securely; used to get new access tokens |
| expires_in | Access token lifetime in seconds (86400 = 24h) |
| user | Current user profile |

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "Missing client_id, redirect_uri, login, or password" }` | Required field missing |
| 401 | `{ "error": "Invalid client_id or redirect_uri" }` | Client not found or redirect_uri mismatch |
| 401 | `{ "error": "Invalid credentials" }` | Wrong email/username or password |
| 500 | `{ "error": "Login failed" }` | Server error |

---

## 4. Refresh Token

**Endpoint:** `POST /api/bsplus/refresh`  
**Auth:** None required.

Exchange a refresh token for a new access token. Implements rolling sessions: the response includes a new refresh token; always replace the stored one.

### Request

```json
{
  "refresh_token": "session_id:secret_base64",
  "client_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| refresh_token | string | Yes | Format `session_id:secret` from login or previous refresh |
| client_id | string | Yes | Same client_id used at login |

### Response (200)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "new_session_id:new_secret_base64",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "displayName": "Display Name",
    "pfpUrl": "https://...",
    "admin_level": 0
  }
}
```

**Important:** Replace the stored refresh token with `refresh_token` from the response.

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "Missing refresh_token or client_id" }` | Required field missing |
| 400 | `{ "error": "Invalid refresh_token format" }` | Token not in `session_id:secret` format |
| 401 | `{ "error": "Invalid refresh_token" }` | Token invalid or revoked |
| 401 | `{ "error": "Invalid client_id" }` | client_id does not match session |
| 401 | `{ "error": "Refresh token expired" }` | Session expired (90 days) |
| 500 | `{ "error": "Refresh failed" }` | Server error |

---

## 5. Discord OAuth (Optional)

**Endpoint:** `GET /api/oauth/bsplus/discord?client_id=<id>&redirect_uri=<uri>`  
**Auth:** None required.

Initiates Discord OAuth. Opens the user's browser to authenticate with Discord. On success, redirects to `redirect_uri` with `token`, `user_id`, and `refresh_token` in the query string.

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| client_id | Yes | From reserve or admin OAuth client |
| redirect_uri | Yes | Must match the URI used when reserving. Callback receives `?token=...&user_id=...&refresh_token=...` |

### Example

```
https://accounts.betterseqta.org/api/oauth/bsplus/discord?client_id=550e8400-e29b-41d4-a716-446655440000&redirect_uri=https%3A%2F%2Faccounts.betterseqta.org%2Fauth%2Fbsplus%2Fcallback
```

### Callback

On success, the user is redirected to:

```
{redirect_uri}?token={access_token}&user_id={user_id}&refresh_token={refresh_token}
```

Store all three values. Use `token` as the access token and `refresh_token` for the refresh flow.
