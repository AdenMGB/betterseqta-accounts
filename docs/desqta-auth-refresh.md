# DesQTA Auth Refresh Implementation Guide

This guide explains how to integrate the **persistent authentication** system into DesQTA, using access tokens and refresh tokens to stay logged in across IP changes, network transitions, and token expiration.

## Overview

The system uses two tokens:

- **Access token** (24h): Used for API requests as `Authorization: Bearer <token>`
- **Refresh token** (90d): Stored securely; used to obtain new access tokens without re-login

When the access token expires or API returns 401, DesQTA calls the refresh endpoint to get a new access token. Each refresh also rotates the refresh token (rolling sessions), so sessions stay valid as long as the app is used regularly.

## Prerequisites

1. Register DesQTA as an OAuth client at `https://accounts.betterseqta.org/admin` (OAuth Clients tab)
2. Note your **Client ID** and registered **Redirect URI** (e.g. `desqta://auth/callback`)

## 1. Configuration Endpoint

**Endpoint:** `GET /api/desqta/config?client_id=<your-client-id>`

Returns URLs for the API. Use this to avoid hardcoding base URLs.

**Example request:**
```
GET https://accounts.betterseqta.org/api/desqta/config?client_id=your-client-id
```

**Response:**
```json
{
  "client_id": "your-client-id",
  "api_url": "https://accounts.betterseqta.org",
  "refresh_url": "https://accounts.betterseqta.org/api/desqta/refresh",
  "discord_auth_url": "https://accounts.betterseqta.org/api/oauth/desqta/discord"
}
```

## 2. Initial Login

### Discord OAuth

Use the existing Discord OAuth flow. The callback URL now includes `refresh_token`:

```
desqta://auth/callback?token=eyJ...&user_id=...&refresh_token=session_id:secret
```

**Important:** Store both `token` (access token) and `refresh_token`.

### Email/Password Login

**Endpoint:** `POST /api/desqta/login`

**Request body:**
```json
{
  "client_id": "your-client-id",
  "redirect_uri": "desqta://auth/callback",
  "login": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "session_id:secret",
  "expires_in": 86400,
  "user": {
    "id": "...",
    "email": "...",
    "username": "...",
    "displayName": "...",
    "pfpUrl": "...",
    "admin_level": 0
  }
}
```

## 3. Refresh Flow

**Endpoint:** `POST /api/desqta/refresh`

**Request body:**
```json
{
  "refresh_token": "session_id:secret",
  "client_id": "your-client-id"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "new_session_id:new_secret",
  "user": { "id": "...", "username": "...", "displayName": "...", "email": "..." }
}
```

**Important:** Always replace the stored refresh token with the new one in the response (rolling sessions).

## 4. Client Implementation

### Auth Service

```typescript
// src/services/auth.ts

const API_URL = 'https://accounts.betterseqta.org';
const DESQTA_CLIENT_ID = 'your-client-id-from-admin';
const DESQTA_REDIRECT_URI = 'desqta://auth/callback';

// Storage keys (use tauri-plugin-store in production)
const STORAGE_ACCESS = 'bs_token';
const STORAGE_REFRESH = 'bs_refresh_token';
const STORAGE_USER = 'bs_user';

export const authService = {
  async getConfig() {
    const res = await fetch(`${API_URL}/api/desqta/config?client_id=${DESQTA_CLIENT_ID}`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  async loginWithDiscord() {
    const authUrl = new URL(`${API_URL}/api/oauth/desqta/discord`);
    authUrl.searchParams.set('client_id', DESQTA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', DESQTA_REDIRECT_URI);
    const { open } = await import('@tauri-apps/api/shell');
    await open(authUrl.toString());
  },

  async loginWithPassword(login: string, password: string) {
    const res = await fetch(`${API_URL}/api/desqta/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: DESQTA_CLIENT_ID,
        redirect_uri: DESQTA_REDIRECT_URI,
        login,
        password,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    this.saveTokens(data.access_token, data.refresh_token, data.user);
    return data.user;
  },

  saveTokens(accessToken: string, refreshToken: string, user: any) {
    localStorage.setItem(STORAGE_ACCESS, accessToken);
    localStorage.setItem(STORAGE_REFRESH, refreshToken);
    localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  },

  async handleDiscordCallback(token: string, userId: string, refreshToken: string) {
    const user = await this.getProfile(token);
    this.saveTokens(token, refreshToken, user);
    return user;
  },

  getToken() {
    return localStorage.getItem(STORAGE_ACCESS);
  },

  getRefreshToken() {
    return localStorage.getItem(STORAGE_REFRESH);
  },

  getUser() {
    const user = localStorage.getItem(STORAGE_USER);
    return user ? JSON.parse(user) : null;
  },

  async refresh() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API_URL}/api/desqta/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, client_id: DESQTA_CLIENT_ID }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      this.logout();
      throw new Error(err.error || 'Refresh failed');
    }

    const data = await res.json();
    this.saveTokens(data.access_token, data.refresh_token, data.user);
    return data.access_token;
  },

  async getProfile(token?: string) {
    const t = token || this.getToken();
    if (!t) throw new Error('Not authenticated');
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  logout() {
    localStorage.removeItem(STORAGE_ACCESS);
    localStorage.removeItem(STORAGE_REFRESH);
    localStorage.removeItem(STORAGE_USER);
  },
};
```

### 401 Retry with Refresh

Wrap API calls to retry once after refresh when the access token is invalid:

```typescript
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  let token = authService.getToken();

  const doRequest = (t: string) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${t}`,
      },
    });

  let res = await doRequest(token!);

  if (res.status === 401) {
    try {
      token = await authService.refresh();
      res = await doRequest(token);
    } catch {
      throw new Error('Session expired');
    }
  }

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// Usage
const settings = await apiRequest('/api/settings');
```

### Deep Link Callback

When handling `desqta://auth/callback`:

```typescript
async function handleAuthCallback(url: string) {
  const urlObj = new URL(url);
  if (urlObj.protocol === 'desqta:' && urlObj.hostname === 'auth') {
    const token = urlObj.searchParams.get('token');
    const userId = urlObj.searchParams.get('user_id');
    const refreshToken = urlObj.searchParams.get('refresh_token');

    if (token && userId && refreshToken) {
      await authService.handleDiscordCallback(token, userId, refreshToken);
      console.log('Logged in successfully');
    } else if (token && userId) {
      // Legacy: no refresh_token (old callback)
      authService.saveTokens(token, '', await authService.getProfile(token));
    }
  }
}
```

## 5. Storage

Use `tauri-plugin-store` instead of `localStorage` for sensitive data in production:

```typescript
import { Store } from 'tauri-plugin-store';

const store = new Store('.auth.dat');

async function saveTokens(access: string, refresh: string, user: any) {
  await store.set('access_token', access);
  await store.set('refresh_token', refresh);
  await store.set('user', JSON.stringify(user));
  await store.save();
}
```

## 6. Logout

On logout, clear local tokens:

```typescript
authService.logout();
```

A future `POST /api/desqta/revoke` endpoint could invalidate the refresh token server-side; for now, clearing it locally is sufficient.

## 7. Error Handling

| Error | Action |
|-------|--------|
| `Invalid refresh_token` | Clear tokens, redirect to login |
| `Refresh token expired` | Clear tokens, redirect to login |
| `Invalid client_id` | Check Client ID in admin dashboard |
| `Invalid credentials` | Show error message on login form |

## 8. Token Lifetimes

- **Access token:** 24 hours
- **Refresh token:** 90 days (rolling: each refresh extends validity)
- **Recommendation:** Refresh proactively when access token has < 1 hour left, or on any 401

## Related Documentation

- [DesQTA Discord OAuth Guide](./desqta-discord-oauth.md)
- [DesQTA Integration Guide](./desqta-integration.md)
