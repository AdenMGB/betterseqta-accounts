# DesQTA Integration Guide

This guide explains how to integrate authentication and settings synchronization into the DesQTA (Tauri + Svelte + TypeScript) application using the Cloudflare Worker backend.

## 1. Authentication Service

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

## 2. Settings Synchronization Service

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

## 3. Usage Example (Svelte)

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

