# Auth Session Migration Guide

This guide explains the new durable session system for the BetterSEQTA website, DesQTA, and BetterSEQTA Plus.

## Why this change was made

Users were being signed out too often because the old auth model had two main weaknesses:

1. The main website used a single JWT stored in `localStorage` with no real refresh flow.
2. DesQTA and BetterSEQTA Plus had refresh-backed sessions, but those sessions were still entangled with reserved client records that expire after 7 days.

The goal of this migration is to make sign-in durable across:
- browser restarts
- app restarts
- IP changes
- network changes
- multiple devices
- long periods of normal use

## High-level architecture

The new system uses:
- short-lived access tokens
- long-lived refresh-backed server sessions
- one session per login/device/app install
- no hard IP binding
- no hard device fingerprint binding

That means a user can stay signed in on multiple devices at the same time, and changing networks should not log them out.

## New session table

A new shared table was added in `migrations/0011_user_sessions.sql`.

```sql
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    client_id TEXT,
    refresh_token_hash TEXT NOT NULL,
    session_family_id TEXT,
    device_name TEXT,
    user_agent TEXT,
    created_ip TEXT,
    last_ip TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    last_used_at INTEGER,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
);
```

### Field meanings

- `id`: unique session ID
- `user_id`: user that owns the session
- `platform`: `web`, `desqta`, or `bsplus`
- `client_id`: optional app/client metadata
- `refresh_token_hash`: hashed secret used to validate refresh tokens
- `session_family_id`: reserved for future rotation/family support
- `device_name`: human-readable device/app label
- `user_agent`: optional user agent for debugging
- `created_ip`: IP seen when session was created
- `last_ip`: latest IP seen when session was used
- `created_at`: when the session was created
- `last_used_at`: latest refresh/use timestamp
- `expires_at`: session expiry time
- `revoked_at`: null unless session was revoked

## Migration behavior

The migration also copies legacy `desqta_sessions` into `user_sessions` so existing app sessions can continue to work.

```sql
INSERT INTO user_sessions (
    id,
    user_id,
    platform,
    client_id,
    refresh_token_hash,
    device_name,
    created_at,
    last_used_at,
    expires_at,
    revoked_at
)
SELECT
    id,
    user_id,
    'desqta',
    client_id,
    refresh_token_hash,
    device_id,
    created_at,
    last_used_at,
    expires_at,
    NULL
FROM desqta_sessions
WHERE NOT EXISTS (
    SELECT 1 FROM user_sessions existing WHERE existing.id = desqta_sessions.id
);
```

Important note:
- legacy `desqta_sessions` rows are migrated as platform `desqta`
- older BetterSEQTA Plus sessions are not distinguishable from old DesQTA rows at migration time, so they are treated as legacy app sessions unless re-authenticated

## Website auth flow now

The main website no longer relies only on a long-lived JWT in `localStorage`.

### Old behavior
- login returned one `7d` JWT
- frontend stored it in `localStorage`
- if `/api/auth/me` failed, the token was deleted
- any expiry or transient auth issue could force logout

### New behavior
- login/register/Discord callback create a `user_sessions` row
- backend issues a short-lived access token
- backend sets a long-lived refresh cookie
- frontend silently refreshes if access token is missing or expired

### Website refresh cookie

The website uses an `HttpOnly`, `Secure`, `SameSite=Lax` cookie:
- cookie name: `bs_refresh_token`
- intended use: refresh website access tokens without exposing refresh token JS-side

This is safer than storing the long-lived refresh token in `localStorage`.

## New website endpoints

### `POST /api/auth/refresh`
Used by the website frontend to get a fresh access token from the refresh cookie.

Behavior:
- reads the refresh cookie
- validates the refresh token against `user_sessions`
- verifies session is not revoked or expired
- verifies session platform is `web`
- issues a new short-lived access token
- extends session expiry
- refreshes the cookie lifetime

### `POST /api/auth/logout`
Used to log out the current website session only.

Behavior:
- finds the current refresh session from the cookie
- revokes that one session
- clears the refresh cookie

### `POST /api/auth/logout-all`
Used to revoke all website sessions for the current user.

Behavior:
- requires valid access token
- revokes all `web` sessions for the current user
- clears the refresh cookie

## Frontend website behavior

The frontend auth composable was updated so it no longer treats every auth fetch failure like a permanent logout.

### New `useAuth.ts` behavior

When `fetchUser()` runs:
1. It tries to use the current access token.
2. If none exists, it tries `/api/auth/refresh`.
3. If `/api/auth/me` returns `401`, it tries one silent refresh.
4. It retries `/api/auth/me` with the new token.
5. It only clears local auth state if refresh also fails with `401`.

This prevents temporary issues from logging users out immediately.

### Middleware behavior

The global auth middleware now calls `fetchUser()` even when no token is currently present, so the website can restore a valid session from the refresh cookie.

## DesQTA and BetterSEQTA Plus auth flow now

DesQTA and BetterSEQTA Plus now use the shared `user_sessions` table for new sessions.

### Old behavior
- app login created rows in `desqta_sessions`
- refresh logic validated against `desqta_sessions`
- reserved client TTL could still affect session continuity indirectly

### New behavior
- app login creates rows in `user_sessions`
- `platform` is set to `desqta` or `bsplus`
- refresh validates against `user_sessions`
- refresh no longer depends on reserved client freshness
- `client_id` is treated as metadata, not as the true lifetime authority for a session

## Very important change: reserved client TTL is no longer the session authority

Reserved clients still exist and still matter for:
- bootstrap
- login initiation
- redirect URI validation
- OAuth start flows

But they should **not** be treated as the source of truth for whether an already-authenticated session is still valid.

This is one of the biggest fixes in this migration.

### Before
A user could still have a valid refreshable app session, but the app might effectively lose continuity because reserved client state had expired.

### After
An existing app session is valid if:
- the session row exists
- the refresh token hash matches
- the session is not revoked
- the session is not expired

That is the durable session rule now.

## Access token lifetime vs refresh session lifetime

### Access tokens
Access tokens are intentionally short-lived.

Reason:
- limits damage if leaked
- forces session continuity through the durable refresh/session layer

### Refresh-backed sessions
Refresh sessions are long-lived.

Current design intent:
- website sessions live long-term and silently renew
- app sessions also live long-term and renew on refresh
- multiple sessions can coexist for the same user

## What client developers need to do

## Website developers
No extra architectural work should be needed beyond what was already implemented here.

What the website now expects:
- access token can expire often
- refresh happens automatically through `/api/auth/refresh`
- the browser must allow secure cookies for the domain

## DesQTA developers
DesQTA should:
1. store both `access_token` and `refresh_token`
2. call refresh when API calls return `401` or before token expiry
3. replace the stored access token with the refreshed token
4. only sign the user out if refresh fails
5. not treat expired reserved client state as a reason to kill an otherwise valid session

## BetterSEQTA Plus developers
BetterSEQTA Plus should follow the same rules as DesQTA:
1. persist `refresh_token` safely per install/profile
2. refresh before forcing logout
3. retry the original request after refresh
4. only clear auth if refresh is invalid or expired

## What does not matter anymore

These should no longer be treated as reasons to sign the user out:
- changing IP address
- switching between school/home/mobile internet
- browser restart
- app restart
- another device also being signed in

## What still causes sign-out legitimately

Users should still be signed out when:
- refresh token is missing
- refresh token is invalid
- session is revoked
- session is fully expired
- user account no longer exists

## Deploy / migration checklist

Before expecting the new behavior in production:

1. Run the DB migration that creates `user_sessions`
2. Deploy the updated worker/backend
3. Deploy the updated website frontend
4. Verify cookies are working over HTTPS
5. Verify DesQTA refresh logic still works against the new shared session model
6. Verify BetterSEQTA Plus refresh logic still works against the new shared session model

## Testing checklist

### Website
- log in normally
- refresh the page
- close and reopen browser
- verify session restores without re-login
- simulate expired access token and verify silent refresh works
- verify logout clears only current session

### DesQTA
- log in on device A
- restart app
- verify still signed in
- sign in on device B
- verify device A remains signed in
- verify refresh works after access token expiry

### BetterSEQTA Plus
- log in in one browser profile
- restart browser
- verify still signed in
- sign in on another browser/profile/device
- verify both remain signed in
- verify extension refresh flow handles token expiry gracefully

## Known migration caveat

The migration copies old `desqta_sessions` into `user_sessions`, but legacy session rows are tagged as `desqta` because that is what the old table represented.

If BetterSEQTA Plus has any legacy rows inside that old session pool and needs explicit `bsplus` platform tagging for downstream behavior, the cleanest fix is simply to re-authenticate those sessions over time or run a targeted corrective migration if you have a reliable way to identify them.

## Summary

This migration changes auth from fragile token-only or partially-coupled session behavior into a durable shared session model.

Main improvements:
- one long-lived session model across web and apps
- multi-device sign-in support
- no hard IP/device binding
- website silent refresh
- app sessions no longer depend on reserved client TTL to stay alive
- safer refresh handling through server-side session validation
