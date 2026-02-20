# BetterSEQTA Plus – Integration Guide

Step-by-step guide for integrating BS Cloud authentication into the BetterSEQTA Plus browser extension or web app.

## Prerequisites

- BS Cloud base URL: `https://accounts.betterseqta.org`
- A `redirect_uri` for your app (e.g. `https://accounts.betterseqta.org/auth/bsplus/callback` or `chrome-extension://<extension-id>/auth/callback`)

## 1. Reserve Client ID on Startup

Call the reserve endpoint once per app instance, before any login. Store the returned `client_id` (e.g. in `chrome.storage.local` or `localStorage`).

```typescript
const API_URL = 'https://accounts.betterseqta.org';
const REDIRECT_URI = 'https://accounts.betterseqta.org/auth/bsplus/callback';

async function getClientId(): Promise<string> {
  // Check storage first
  const stored = await chrome.storage.local.get('bsplus_client_id');
  if (stored.bsplus_client_id) return stored.bsplus_client_id;

  const res = await fetch(`${API_URL}/api/bsplus/client/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uri: REDIRECT_URI })
  });
  if (!res.ok) throw new Error('Failed to reserve client');

  const data = await res.json();
  await chrome.storage.local.set({ bsplus_client_id: data.client_id });
  return data.client_id;
}
```

## 2. Login with Email/Username + Password

Use the reserved `client_id` and `redirect_uri` for login.

```typescript
async function loginWithPassword(login: string, password: string) {
  const clientId = await getClientId();
  const res = await fetch(`${API_URL}/api/bsplus/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      login,
      password
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Login failed');
  }

  const data = await res.json();
  await saveTokens(data.access_token, data.refresh_token, data.user);
  return data.user;
}

async function saveTokens(accessToken: string, refreshToken: string, user: any) {
  await chrome.storage.local.set({
    bsplus_token: accessToken,
    bsplus_refresh_token: refreshToken,
    bsplus_user: user
  });
}
```

## 3. Refresh When Token Expires

When the access token expires or an API returns 401, call the refresh endpoint and update stored tokens.

```typescript
async function refreshTokens(): Promise<void> {
  const { bsplus_refresh_token, bsplus_client_id } = await chrome.storage.local.get([
    'bsplus_refresh_token',
    'bsplus_client_id'
  ]);

  if (!bsplus_refresh_token || !bsplus_client_id) {
    throw new Error('Not logged in');
  }

  const res = await fetch(`${API_URL}/api/bsplus/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: bsplus_refresh_token,
      client_id: bsplus_client_id
    })
  });

  if (!res.ok) {
    const err = await res.json();
    if (res.status === 401) {
      await logout();
      throw new Error('Session expired');
    }
    throw new Error(err.error || 'Refresh failed');
  }

  const data = await res.json();
  await saveTokens(data.access_token, data.refresh_token, data.user);
}
```

## 4. Make Authenticated API Requests

Use the access token in the `Authorization` header.

```typescript
async function apiRequest(path: string, options: RequestInit = {}) {
  const { bsplus_token } = await chrome.storage.local.get('bsplus_token');
  if (!bsplus_token) throw new Error('Not authenticated');

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${bsplus_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (res.status === 401) {
    await refreshTokens();
    return apiRequest(path, options); // Retry once
  }

  return res;
}
```

## 5. Discord OAuth (Optional)

For Discord login, open the auth URL in a new tab. The callback page must read `token`, `user_id`, and `refresh_token` from the URL and store them.

```typescript
async function loginWithDiscord() {
  const clientId = await getClientId();
  const authUrl = `${API_URL}/api/oauth/bsplus/discord?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  await chrome.tabs.create({ url: authUrl });
}
```

**Callback page** (e.g. `/auth/bsplus/callback` or extension page):

```typescript
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const refreshToken = params.get('refresh_token');
const userId = params.get('user_id');

if (token && refreshToken && userId) {
  const clientId = await getClientId();
  const userRes = await fetch(`${API_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const user = await userRes.json();
  await saveTokens(token, refreshToken, user);
  window.close();
}
```

## 6. Logout

Clear stored tokens and optionally the client ID.

```typescript
async function logout() {
  await chrome.storage.local.remove([
    'bsplus_token',
    'bsplus_refresh_token',
    'bsplus_user'
  ]);
}
```

## Full Auth Service Example

```typescript
const API_URL = 'https://accounts.betterseqta.org';
const REDIRECT_URI = 'https://accounts.betterseqta.org/auth/bsplus/callback';

export const bsPlusAuth = {
  async getClientId(): Promise<string> {
    const stored = await chrome.storage.local.get('bsplus_client_id');
    if (stored.bsplus_client_id) return stored.bsplus_client_id;

    const res = await fetch(`${API_URL}/api/bsplus/client/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_uri: REDIRECT_URI })
    });
    if (!res.ok) throw new Error('Failed to reserve client');
    const data = await res.json();
    await chrome.storage.local.set({ bsplus_client_id: data.client_id });
    return data.client_id;
  },

  async login(login: string, password: string) {
    const clientId = await this.getClientId();
    const res = await fetch(`${API_URL}/api/bsplus/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, redirect_uri: REDIRECT_URI, login, password })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
    const data = await res.json();
    await chrome.storage.local.set({
      bsplus_token: data.access_token,
      bsplus_refresh_token: data.refresh_token,
      bsplus_user: data.user
    });
    return data.user;
  },

  async refresh() {
    const { bsplus_refresh_token, bsplus_client_id } = await chrome.storage.local.get([
      'bsplus_refresh_token', 'bsplus_client_id'
    ]);
    if (!bsplus_refresh_token || !bsplus_client_id) throw new Error('Not logged in');

    const res = await fetch(`${API_URL}/api/bsplus/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: bsplus_refresh_token, client_id: bsplus_client_id })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Refresh failed');
    const data = await res.json();
    await chrome.storage.local.set({
      bsplus_token: data.access_token,
      bsplus_refresh_token: data.refresh_token,
      bsplus_user: data.user
    });
    return data.user;
  },

  async logout() {
    await chrome.storage.local.remove(['bsplus_token', 'bsplus_refresh_token', 'bsplus_user']);
  }
};
```
