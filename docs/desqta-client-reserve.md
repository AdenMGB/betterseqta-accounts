# DesQTA Client ID Reserve Flow

This guide explains how to integrate the **client ID reserve** flow into DesQTA. It allows any user (logged in or not) to obtain a unique `client_id` before authenticating, eliminating the need for admin pre-registration.

> **Note for accounts.betterseqta.org admins:** Run migrations `0007_desqta_reserved_clients.sql` and `0008_desqta_reserved_clients_expires.sql` before deploying:
> ```bash
> pnpm db:migrate:remote
> ```

## Overview

**Before:** DesQTA had to be pre-registered as an OAuth client in the admin dashboard. Each app instance used the same hardcoded `client_id`.

**After:** DesQTA can call the reserve endpoint on app startup (before login). Each app instance gets a unique `client_id` that is used for all subsequent auth flows (email/password login, Discord OAuth, refresh).

## New Endpoint: Reserve Client ID

**Endpoint:** `POST /api/desqta/client/reserve`

**Auth:** None required. Anyone can call this.

**Request body:**
```json
{
  "redirect_uri": "desqta://auth/callback"
}
```

- `redirect_uri` (optional): Defaults to `desqta://auth/callback` if omitted. Must match the URI you use for login and Discord OAuth callbacks.

**Response:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "redirect_uri": "desqta://auth/callback",
  "api_url": "https://accounts.betterseqta.org",
  "config_url": "https://accounts.betterseqta.org/api/desqta/config",
  "refresh_url": "https://accounts.betterseqta.org/api/desqta/refresh",
  "login_url": "https://accounts.betterseqta.org/api/desqta/login",
  "discord_auth_url": "https://accounts.betterseqta.org/api/oauth/desqta/discord"
}
```

## Integration Flow

### 1. On App Startup (Before Login)

Call the reserve endpoint **once per app instance**. Store the returned `client_id` and `redirect_uri` (e.g. in Tauri store or localStorage).

```typescript
const REDIRECT_URI = 'desqta://auth/callback';

async function ensureClientId(): Promise<{ client_id: string; redirect_uri: string }> {
  // Check if we already have a stored client_id
  let clientId = await store.get('client_id');
  if (clientId) return { client_id: clientId, redirect_uri: REDIRECT_URI };

  const res = await fetch('https://accounts.betterseqta.org/api/desqta/client/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uri: REDIRECT_URI })
  });
  if (!res.ok) throw new Error('Failed to reserve client');
  const data = await res.json();
  await store.set('client_id', data.client_id);
  return { client_id: data.client_id, redirect_uri: data.redirect_uri };
}
```

### 2. Use the Reserved Client ID for Login

**Email/Password Login** – `POST /api/desqta/login`:

```json
{
  "client_id": "<reserved-client-id>",
  "redirect_uri": "desqta://auth/callback",
  "login": "user@example.com",
  "password": "your-password"
}
```

**Discord OAuth** – Open the auth URL:

```
GET /api/oauth/desqta/discord?client_id=<reserved-client-id>&redirect_uri=desqta://auth/callback
```

### 3. Use the Reserved Client ID for Refresh

`POST /api/desqta/refresh`:

```json
{
  "refresh_token": "session_id:secret",
  "client_id": "<reserved-client-id>"
}
```

## Full Auth Service Example

```typescript
const API_URL = 'https://accounts.betterseqta.org';
const REDIRECT_URI = 'desqta://auth/callback';

export const authService = {
  async getClientId(): Promise<string> {
    let clientId = localStorage.getItem('bs_client_id');
    if (clientId) return clientId;

    const res = await fetch(`${API_URL}/api/desqta/client/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_uri: REDIRECT_URI })
    });
    if (!res.ok) throw new Error('Failed to reserve client');
    const data = await res.json();
    localStorage.setItem('bs_client_id', data.client_id);
    return data.client_id;
  },

  async loginWithPassword(login: string, password: string) {
    const clientId = await this.getClientId();
    const res = await fetch(`${API_URL}/api/desqta/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        login,
        password
      })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
    const data = await res.json();
    this.saveTokens(data.access_token, data.refresh_token, data.user);
    return data.user;
  },

  async loginWithDiscord() {
    const clientId = await this.getClientId();
    const authUrl = `${API_URL}/api/oauth/desqta/discord?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    const { open } = await import('@tauri-apps/api/shell');
    await open(authUrl);
  },

  async refresh() {
    const clientId = await this.getClientId();
    const refreshToken = localStorage.getItem('bs_refresh_token');
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API_URL}/api/desqta/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, client_id: clientId })
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    this.saveTokens(data.access_token, data.refresh_token, data.user);
    return data.user;
  },

  saveTokens(accessToken: string, refreshToken: string, user: any) {
    localStorage.setItem('bs_token', accessToken);
    localStorage.setItem('bs_refresh_token', refreshToken);
    localStorage.setItem('bs_user', JSON.stringify(user));
  }
};
```

## Migration from Admin-Registered Clients

If you previously used an admin-registered `client_id`:

- **Option A:** Keep using it. The API still accepts both admin-registered and reserved client IDs.
- **Option B:** Switch to the reserve flow. Call `POST /api/desqta/client/reserve` on app startup and use the returned `client_id` everywhere.

## When to Call Reserve

- **On first launch or whenever `client_id` is missing:** Call reserve once.
- **Store the result:** Persist `client_id` in your app storage (localStorage, Tauri store, etc.).
- **Same device:** Reuse the same `client_id` for all subsequent logins and refresh requests on that device.

## Error Handling

| Error | Cause |
|-------|-------|
| `Failed to reserve client` | Network or server error |
| `Invalid client_id or redirect_uri` | Using a reserved client_id with a different redirect_uri than the one used when reserving |
| `Invalid client_id` | client_id not found (e.g. never reserved, or invalid) |

## Expiration & Refresh

Reserved client IDs expire after **7 days** of inactivity. Any use of the client resets the timer to a fresh 7 days:

- `GET /api/desqta/config`
- `POST /api/desqta/login`
- `POST /api/desqta/refresh`
- `GET /api/oauth/desqta/discord` (initiate)
- Discord OAuth callback (after successful login)

If a client_id expires, the app must call `POST /api/desqta/client/reserve` again to get a new one.

## Summary

1. Call `POST /api/desqta/client/reserve` on app startup (before login).
2. Store the returned `client_id`.
3. Use that `client_id` for login, refresh, Discord OAuth, and config.
4. No admin pre-registration required.
5. Client IDs expire after 7 days of inactivity; using them resets the timer.
