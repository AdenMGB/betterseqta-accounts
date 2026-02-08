# DesQTA Integration Guide

This guide explains how to integrate authentication and settings synchronization into the DesQTA (Tauri + Svelte + TypeScript) application using the Cloudflare Worker backend.

## 1. Discord OAuth Setup

Before using Discord OAuth, you need to register DesQTA as an OAuth client:

1. Go to the Admin Dashboard at `https://accounts.betterseqta.org/admin`
2. Navigate to the "OAuth Clients" tab
3. Create a new client with:
   - **Name**: `DesQTA`
   - **Redirect URI**: Your DesQTA callback URL (e.g., `desqta://auth/callback` or `http://localhost:3000/auth/callback`)

You'll receive:
- **Client ID**: Use this in your Discord OAuth requests
- **Client Secret**: Keep this secure (not needed for Discord OAuth flow)

## 2. Discord OAuth Authentication

DesQTA can authenticate users via Discord OAuth. This provides a seamless login experience without requiring users to create a separate account.

### Implementation

Add Discord OAuth support to your `auth.ts` service:

```typescript
// src/services/auth.ts

const API_URL = 'https://accounts.betterseqta.org';
const DESQTA_CLIENT_ID = 'your-oauth-client-id-from-admin-dashboard';
const DESQTA_REDIRECT_URI = 'desqta://auth/callback'; // Your app's callback URL

export const authService = {
  /**
   * Initiates Discord OAuth flow for DesQTA.
   * Opens the user's browser to authenticate with Discord.
   */
  async loginWithDiscord() {
    // Construct the Discord OAuth URL
    const authUrl = new URL(`${API_URL}/api/oauth/desqta/discord`);
    authUrl.searchParams.set('client_id', DESQTA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', DESQTA_REDIRECT_URI);

    // For Tauri, use the shell API to open the browser
    // @ts-ignore
    const { open } = await import('@tauri-apps/api/shell');
    await open(authUrl.toString());
    
    // The user will be redirected back to your app's callback URL
    // Handle the callback in your app (see below)
  },

  /**
   * Handles the Discord OAuth callback.
   * Call this when your app receives the callback with token and user_id.
   */
  async handleDiscordCallback(token: string, userId: string) {
    // Save token securely
    localStorage.setItem('bs_token', token);
    
    // Fetch user profile
    const user = await this.getProfile();
    localStorage.setItem('bs_user', JSON.stringify(user));
    
    return user;
  },

  // ... rest of auth service methods
};
```

### Handling the Callback

In your Tauri app, you need to handle the callback URL. Here's an example for handling the `desqta://auth/callback` URL:

```typescript
// src/main.ts or wherever you handle deep links

import { getCurrentWindow } from '@tauri-apps/api/window';

// Listen for the callback URL
// This depends on how you've configured your Tauri app's protocol handler
async function handleAuthCallback() {
  // Extract token and user_id from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const userId = urlParams.get('user_id');

  if (token && userId) {
    await authService.handleDiscordCallback(token, userId);
    // Navigate to your main app or close the auth window
    getCurrentWindow().close();
  }
}

// Call this when your app loads or when the callback URL is detected
handleAuthCallback();
```

### Usage in Svelte Component

```svelte
<script lang="ts">
  import { authService } from '../services/auth';

  async function handleDiscordLogin() {
    try {
      await authService.loginWithDiscord();
      // The browser will open, user authenticates with Discord
      // Then they'll be redirected back to your app
    } catch (error) {
      console.error('Discord login failed:', error);
    }
  }
</script>

<button on:click={handleDiscordLogin}>
  Sign in with Discord
</button>
```

## 3. Authentication Service

Create a file `src/services/auth.ts` to handle login and token management.

```typescript
// src/services/auth.ts

// Replace with your deployed Worker URL
const API_URL = 'https://betterseqta-account.your-subdomain.workers.dev';

export const authService = {
  /**
   * Logs in the user and saves the session token.
   */
  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Login failed');
    }
    
    const data = await response.json();
    
    // Save token securely. For Tauri, localStorage is okay, but tauri-plugin-store is better.
    localStorage.setItem('bs_token', data.token);
    localStorage.setItem('bs_user', JSON.stringify(data.user));
    
    return data;
  },

  /**
   * Registers a new user.
   */
  async register(email: string, password: string, username: string, displayName: string) {
      const response = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username, displayName })
      });

      if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Registration failed');
      }

      return await response.json();
  },

  /**
   * Logs out the user.
   */
  logout() {
    localStorage.removeItem('bs_token');
    localStorage.removeItem('bs_user');
  },

  /**
   * Gets the stored JWT token.
   */
  getToken() {
    return localStorage.getItem('bs_token');
  },

  /**
   * Gets the stored user info.
   */
  getUser() {
    const user = localStorage.getItem('bs_user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Fetches the latest user profile from the server.
   */
  async getProfile() {
      const token = this.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      
      if (!response.ok) throw new Error('Failed to fetch profile');
      return await response.json();
  }
};
```

## 4. Settings Synchronization Service

Create a file `src/services/settings.ts` to manage fetching and saving settings.

```typescript
// src/services/settings.ts
import { authService } from './auth';

const API_URL = 'https://betterseqta-account.your-subdomain.workers.dev';

export const settingsService = {
  /**
   * Fetches the user's settings from the cloud.
   */
  async getSettings() {
    const token = authService.getToken();
    const user = authService.getUser();
    
    // Return null or throw if not logged in, depending on your app flow
    if (!token || !user) return null;

    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': user.id // Redundant if Worker checks token, but good for fallback
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error fetching settings:', e);
      return null;
    }
  },

  /**
   * Syncs (merges) local settings to the cloud.
   * @param settings The settings object to save.
   */
  async syncSettings(settings: Record<string, any>) {
    const token = authService.getToken();
    const user = authService.getUser();
    if (!token || !user) return;

    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-ID': user.id
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) throw new Error('Failed to save settings');

      const savedData = await response.json();
      console.log('Settings synced successfully');
      return savedData;
    } catch (e) {
      console.error('Sync failed:', e);
      throw e;
    }
  }
};
```

## 5. Usage Example (Svelte)

Here is how you can use these services in a Svelte component (e.g., `src/routes/+page.svelte` or a dedicated Login component).

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { authService } from '../services/auth';
  import { settingsService } from '../services/settings';

  let email = '';
  let password = '';
  let isLoggedIn = false;
  let error = '';
  let userSettings = {};

  onMount(async () => {
    const token = authService.getToken();
    if (token) {
      isLoggedIn = true;
      loadSettings();
    }
  });

  async function loadSettings() {
      const settings = await settingsService.getSettings();
      if (settings) {
          userSettings = settings;
          console.log('Loaded settings:', userSettings);
          // Apply settings to your DesQTA state store here
      }
  }

  async function handleLogin() {
    error = '';
    try {
      await authService.login(email, password);
      isLoggedIn = true;
      await loadSettings();
    } catch (e: any) {
      error = e.message;
    }
  }

  async function handleLogout() {
      authService.logout();
      isLoggedIn = false;
      userSettings = {};
  }

  // Call this whenever settings change in your app
  async function saveSettings() {
      await settingsService.syncSettings(userSettings);
  }
</script>

<div class="container">
  {#if !isLoggedIn}
    <div class="login-form">
      <h2>Login to BetterSEQTA Cloud</h2>
      <form on:submit|preventDefault={handleLogin}>
        <div class="form-group">
            <input type="email" bind:value={email} placeholder="Email" required />
        </div>
        <div class="form-group">
            <input type="password" bind:value={password} placeholder="Password" required />
        </div>
        {#if error}
            <p class="error">{error}</p>
        {/if}
        <button type="submit">Login</button>
      </form>
    </div>
  {:else}
    <div class="dashboard">
      <h1>Welcome, {authService.getUser()?.displayName}</h1>
      <button on:click={handleLogout}>Logout</button>
      
      <div class="settings-preview">
          <h3>Your Cloud Settings</h3>
          <pre>{JSON.stringify(userSettings, null, 2)}</pre>
          <button on:click={saveSettings}>Force Sync</button>
      </div>
    </div>
  {/if}
</div>

<style>
    .container { padding: 2rem; max-width: 600px; margin: 0 auto; }
    .form-group { margin-bottom: 1rem; }
    input { width: 100%; padding: 0.5rem; }
    .error { color: red; }
</style>
```

