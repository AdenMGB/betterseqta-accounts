# BetterSEQTA Plus – BS Cloud Authentication

This folder contains documentation for integrating the **BetterSEQTA Plus** browser extension (or web app) with BS Cloud (accounts.betterseqta.org). The API mirrors the DesQTA flow: client reserve, email/username + password login, refresh tokens, and optional Discord OAuth.

## Overview

BetterSEQTA Plus uses dedicated endpoints under `/api/bsplus/` to authenticate with BS Cloud. The flow is identical to DesQTA:

1. **Reserve a client ID** – Call `POST /api/bsplus/client/reserve` on startup.
2. **Login** – Use `POST /api/bsplus/login` with email/username and password.
3. **Refresh** – Use `POST /api/bsplus/refresh` when the access token expires.
4. **Discord OAuth** (optional) – Use `GET /api/oauth/bsplus/discord` for Discord login.

## Base URL

```
https://accounts.betterseqta.org
```

## Documentation Index

| Document | Description |
|----------|-------------|
| [API Reference](./api-reference.md) | Full endpoint reference with request/response examples |
| [Integration Guide](./integration-guide.md) | Step-by-step integration for the extension |
| [Auth Flow](./auth-flow.md) | Token lifecycle, refresh, and error handling |

## Quick Start

```typescript
const API_URL = 'https://accounts.betterseqta.org';
const REDIRECT_URI = 'https://accounts.betterseqta.org/auth/bsplus/callback'; // or chrome-extension://<id>/auth/callback

// 1. Reserve client (on first launch)
const reserveRes = await fetch(`${API_URL}/api/bsplus/client/reserve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ redirect_uri: REDIRECT_URI })
});
const { client_id } = await reserveRes.json();

// 2. Login with email/username + password
const loginRes = await fetch(`${API_URL}/api/bsplus/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id,
    redirect_uri: REDIRECT_URI,
    login: 'user@example.com',
    password: 'your-password'
  })
});
const { access_token, refresh_token, user } = await loginRes.json();
```

## Storage

Store both `access_token` and `refresh_token` securely. Use the access token for API requests (`Authorization: Bearer <token>`). When it expires or returns 401, call the refresh endpoint to get a new access token and refresh token.
