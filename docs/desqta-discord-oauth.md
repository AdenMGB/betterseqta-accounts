# DesQTA Discord OAuth Integration Guide

This guide explains how to integrate Discord OAuth authentication into DesQTA (Tauri desktop app) using the BetterSEQTA Accounts API.

## Overview

The Discord OAuth flow allows DesQTA users to sign in using their Discord account, eliminating the need to create a separate BetterSEQTA Accounts account. The flow works as follows:

1. DesQTA opens a browser window with the Discord OAuth URL
2. User authenticates with Discord
3. Discord redirects back to the API callback endpoint
4. API creates/updates the user account and generates a JWT token
5. User is redirected back to DesQTA with the token

## Prerequisites

1. **Register DesQTA as an OAuth Client**
   - Go to `https://accounts.betterseqta.org/admin`
   - Navigate to the "OAuth Clients" tab
   - Create a new client with:
     - **Name**: `DesQTA`
     - **Redirect URI**: Your DesQTA callback URL (e.g., `desqta://auth/callback` or `http://localhost:3000/auth/callback`)
   - **Save the Client ID** - This is what DesQTA will use (e.g., `afa43ee2-397d-4f56-ae0f-ae3f7520bc0d`)
   - **Note**: You do NOT need the Client Secret for Discord OAuth flow, and you do NOT use the Discord Client ID/Secret (those are server-side only)

2. **Configure DesQTA Protocol Handler** (for custom URL schemes)
   - If using `desqta://` protocol, configure it in your `tauri.conf.json`
   - See [Tauri Deep Linking Documentation](https://tauri.app/v1/guides/features/deep-linking/)

## API Endpoints

### 1. Initiate Discord OAuth

**Endpoint:** `GET https://accounts.betterseqta.org/api/oauth/desqta/discord`

**Query Parameters:**
- `client_id` (required): Your OAuth Client ID from the admin dashboard
- `redirect_uri` (required): Your registered redirect URI (must match exactly)

**Example:**
```
https://accounts.betterseqta.org/api/oauth/desqta/discord?client_id=your-client-id&redirect_uri=desqta://auth/callback
```

**Response:** Redirects to Discord OAuth authorization page

### 2. Callback Endpoint

**Endpoint:** `GET https://accounts.betterseqta.org/api/oauth/desqta/discord/callback`

This endpoint is handled automatically by the API. After Discord authentication, users are redirected here, then redirected back to your `redirect_uri` with:
- `token`: JWT token for API authentication (30-day expiration)
- `user_id`: User's unique ID

**Example Callback URL:**
```
desqta://auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&user_id=abc-123-def-456
```

## Implementation

### Step 1: Update Auth Service

Add Discord OAuth methods to your `src/services/auth.ts`:

```typescript
// src/services/auth.ts

const API_URL = 'https://accounts.betterseqta.org';
// Use the OAuth Client ID from the admin dashboard (NOT the Discord Client ID)
const DESQTA_CLIENT_ID = 'afa43ee2-397d-4f56-ae0f-ae3f7520bc0d'; // Replace with your actual Client ID
const DESQTA_REDIRECT_URI = 'desqta://auth/callback'; // Must match registered URI exactly

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
    const { open } = await import('@tauri-apps/api/shell');
    await open(authUrl.toString());
    
    // The user will be redirected back to your app's callback URL
    // Handle the callback in your app (see Step 2)
  },

  /**
   * Handles the Discord OAuth callback.
   * Call this when your app receives the callback with token and user_id.
   */
  async handleDiscordCallback(token: string, userId: string) {
    // Save token securely
    // For Tauri, consider using tauri-plugin-store instead of localStorage
    localStorage.setItem('bs_token', token);
    
    // Fetch user profile to get full user data
    const user = await this.getProfile();
    localStorage.setItem('bs_user', JSON.stringify(user));
    
    return user;
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
  },

  /**
   * Logs out the user.
   */
  logout() {
    localStorage.removeItem('bs_token');
    localStorage.removeItem('bs_user');
  }
};
```

### Step 2: Handle Deep Link Callback

In your Tauri app, you need to handle the callback URL. Here are examples for different approaches:

#### Option A: Using Tauri Deep Linking (Recommended)

**1. Configure `tauri.conf.json`:**

```json
{
  "tauri": {
    "bundle": {
      "identifier": "com.yourcompany.desqta"
    },
    "allowlist": {
      "shell": {
        "open": true
      }
    }
  }
}
```

**2. Register protocol handler in `src/main.ts` or `src-tauri/src/main.rs`:**

```rust
// src-tauri/src/main.rs
use tauri::Manager;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      // Handle protocol URL
      app.handle().plugin(
        tauri_plugin_deep_link::init()
      )?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

**3. Listen for deep link events:**

```typescript
// src/main.ts or wherever you initialize your app
import { getCurrentWindow } from '@tauri-apps/api/window';
import { authService } from './services/auth';

// Listen for the callback URL
async function handleAuthCallback(url: string) {
  try {
    const urlObj = new URL(url);
    
    // Check if this is our auth callback
    if (urlObj.protocol === 'desqta:' && urlObj.hostname === 'auth') {
      const token = urlObj.searchParams.get('token');
      const userId = urlObj.searchParams.get('user_id');

      if (token && userId) {
        await authService.handleDiscordCallback(token, userId);
        
        // Navigate to your main app or close the auth window
        // You might want to emit an event or update your app state here
        console.log('Discord login successful!');
        
        // Optionally close the window if it's a separate auth window
        // getCurrentWindow().close();
      }
    }
  } catch (error) {
    console.error('Auth callback error:', error);
  }
}

// Register deep link handler (implementation depends on your Tauri setup)
// This is a simplified example - actual implementation may vary
if (window.location.protocol === 'desqta:') {
  handleAuthCallback(window.location.href);
}
```

#### Option B: Using HTTP Localhost Server (Alternative)

If you prefer using `http://localhost:PORT/auth/callback`:

```typescript
// src/services/auth.ts

// Start a local HTTP server to receive the callback
async function startCallbackServer(): Promise<string> {
  return new Promise((resolve) => {
    // Use a simple HTTP server or Tauri's built-in capabilities
    // This is a conceptual example - actual implementation depends on your setup
    const port = 3000;
    const callbackUrl = `http://localhost:${port}/auth/callback`;
    
    // Set up a listener for the callback
    // When callback is received, resolve with the token
    resolve(callbackUrl);
  });
}

async function loginWithDiscord() {
  const callbackUrl = await startCallbackServer();
  
  const authUrl = new URL(`${API_URL}/api/oauth/desqta/discord`);
  authUrl.searchParams.set('client_id', DESQTA_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);

  const { open } = await import('@tauri-apps/api/shell');
  await open(authUrl.toString());
}
```

### Step 3: Create Login UI Component

Create a login component in Svelte:

```svelte
<!-- src/components/Login.svelte -->
<script lang="ts">
  import { authService } from '../services/auth';
  import { onMount } from 'svelte';

  let isAuthenticated = false;
  let user = null;
  let loading = false;
  let error = '';

  onMount(() => {
    // Check if user is already logged in
    const token = authService.getToken();
    if (token) {
      user = authService.getUser();
      isAuthenticated = true;
    }
  });

  async function handleDiscordLogin() {
    loading = true;
    error = '';
    
    try {
      await authService.loginWithDiscord();
      // The browser will open, user authenticates with Discord
      // The callback will be handled by your deep link handler
    } catch (err: any) {
      error = err.message || 'Discord login failed';
      loading = false;
    }
  }

  function handleLogout() {
    authService.logout();
    isAuthenticated = false;
    user = null;
  }

  // Listen for auth success events (you'll need to implement this)
  // This could be done via Svelte stores, events, or window messages
  function onAuthSuccess() {
    user = authService.getUser();
    isAuthenticated = true;
    loading = false;
  }
</script>

<div class="login-container">
  {#if !isAuthenticated}
    <div class="login-form">
      <h2>Sign in to BetterSEQTA Cloud</h2>
      
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <button 
        on:click={handleDiscordLogin} 
        disabled={loading}
        class="discord-button"
      >
        {#if loading}
          <span>Connecting...</span>
        {:else}
          <span>Sign in with Discord</span>
        {/if}
      </button>
    </div>
  {:else}
    <div class="user-info">
      <h2>Welcome, {user?.displayName || user?.username}</h2>
      <p>Email: {user?.email}</p>
      <button on:click={handleLogout}>Logout</button>
    </div>
  {/if}
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 2rem;
  }

  .login-form {
    max-width: 400px;
    width: 100%;
    padding: 2rem;
    border-radius: 8px;
    background: var(--bg-color, #fff);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .discord-button {
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: #5865F2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .discord-button:hover:not(:disabled) {
    background: #4752C4;
  }

  .discord-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    padding: 0.75rem;
    margin-bottom: 1rem;
    background: #fee;
    color: #c33;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .user-info {
    text-align: center;
  }
</style>
```

## Using the Token

Once you have the token, you can use it to make authenticated API requests:

```typescript
// Example: Fetch user settings
async function fetchSettings() {
  const token = authService.getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/settings`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) throw new Error('Failed to fetch settings');
  return await response.json();
}

// Example: Save settings
async function saveSettings(settings: Record<string, any>) {
  const token = authService.getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(settings)
  });

  if (!response.ok) throw new Error('Failed to save settings');
  return await response.json();
}
```

## Token Expiration

The JWT token issued for DesQTA has a **30-day expiration** (longer than web tokens for better desktop app UX). When the token expires:

1. API requests will return `401 Unauthorized`
2. You should prompt the user to sign in again
3. Call `authService.loginWithDiscord()` to re-authenticate

## Error Handling

Common errors and how to handle them:

- **`Invalid client_id`**: Check that your Client ID is correct and the OAuth client exists in the admin dashboard
- **`redirect_uri does not match`**: Ensure the redirect URI in your request exactly matches the one registered in the admin dashboard
- **`Discord OAuth not configured`**: Server-side issue - contact administrator
- **`Failed to exchange Discord code`**: Network or Discord API issue - retry the login flow

## Security Considerations

1. **Store tokens securely**: Consider using `tauri-plugin-store` instead of `localStorage` for sensitive data
2. **Validate redirect URIs**: Always validate that callback URLs match your registered redirect URI
3. **Handle token expiration**: Implement proper error handling for expired tokens
4. **Use HTTPS in production**: Ensure your API URL uses HTTPS in production

## Troubleshooting

### Callback not being received

1. Verify your protocol handler is correctly configured in `tauri.conf.json`
2. Check that the redirect URI matches exactly (including protocol, host, and path)
3. Test the deep link handler separately before integrating with OAuth

### Token not working

1. Verify the token is being saved correctly
2. Check that the `Authorization` header is formatted as `Bearer <token>`
3. Ensure the token hasn't expired (30-day expiration)

### User account not created

1. Check Discord OAuth configuration on the server
2. Verify Discord API credentials are set correctly
3. Check server logs for any errors during user creation

## Additional Resources

- [Tauri Deep Linking Guide](https://tauri.app/v1/guides/features/deep-linking/)
- [Tauri Shell API](https://tauri.app/v1/api/js/shell/)
- [BetterSEQTA Accounts API Documentation](./auth-user-api.md)
- [General DesQTA Integration Guide](./desqta-integration.md)
