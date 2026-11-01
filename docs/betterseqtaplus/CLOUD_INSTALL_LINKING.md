# BetterSEQTA Cloud — install linking

Extension **install UUIDs** are tied to authenticated cloud users for remote config targeting, support, and a future **Devices** UI on accounts.

**Client:** BetterSEQTA+ `cloudInstallLink.ts`  
**Related:** [Cloud settings sync](./CLOUD_SETTINGS_SYNC_SERVER.md) · [API reference](./api-reference.md)

Base URL: `https://accounts.betterseqta.org`

## Authentication

All routes require:

```http
Authorization: Bearer <access_token>
```

Same tokens as `/api/bsplus/login` and `/api/bsplus/refresh`. User identity comes **only** from the token.

---

## `POST /api/bsplus/installs/link`

Idempotent upsert: links `installId` to the authenticated user. Re-posting updates metadata (`deviceName`, `extension`, `lastSeenAt`). If the same browser profile signs in as a different user, the row is **re-assigned** to the new account.

**Body**

```json
{
  "installId": "550e8400-e29b-41d4-a716-446655440000",
  "extension": { "version": "3.7.0", "channel": "stable", "browser": "chrome" },
  "deviceName": "Aden's Chrome",
  "lastSeenAt": "2026-11-02T00:00:00.000Z"
}
```

| Field | Rules |
|-------|--------|
| `installId` | UUID (v1–v5) |
| `extension.version` | Semver-ish string, max 64 chars |
| `extension.channel` | `stable` \| `nightly` \| `unknown` (others → `unknown`) |
| `extension.browser` | Lowercase identifier (e.g. `chrome`) |
| `deviceName` | Optional, max 200 chars |
| `lastSeenAt` | ISO-8601 UTC |

**Responses**

| Status | Meaning |
|--------|---------|
| `201` | New install link created |
| `200` | Existing `installId` updated |
| `401` | Missing/invalid token |
| `422` | Validation error |

**Response body:** `{ "success": true }`

**D1 table:** `bsplus_install_link` (migration `0028_bsplus_install_links.sql`)

---

## `GET /api/bsplus/installs`

Lists installs for the authenticated user (newest `lastSeenAt` first).

**200**

```json
{
  "success": true,
  "data": {
    "installs": [
      {
        "installId": "550e8400-e29b-41d4-a716-446655440000",
        "deviceName": "Aden's Chrome",
        "extension": { "version": "3.7.0", "channel": "stable", "browser": "chrome" },
        "lastSeenAt": "2026-11-02T00:00:00.000Z",
        "linkedAt": "2026-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

## `DELETE /api/bsplus/installs/{installId}`

Removes the link for the authenticated user only. Extension does not call this yet; intended for account portal “revoke device”.

**404** if not found for this user · **200** `{ "success": true }`

---

## Account deletion

User delete (self-service or admin) removes rows in `bsplus_install_link` for that `cloud_user_id`.

---

## Client behaviour (summary)

| Event | Action |
|-------|--------|
| Signed in + register on `betterseqta.org` | `POST …/installs/link` |
| Sign-in / refresh / user change | Force link (not throttled) |
| Routine heartbeat | Throttled ~24h per profile |
| Logout | No server call; link remains until revoked |
