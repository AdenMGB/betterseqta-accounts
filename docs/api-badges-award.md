# Award user badges (interop API)

Grant achievement badges on BetterSEQTA Accounts from trusted services (for example **BetterSEQTA.org** when a custom theme is approved). Founder badges remain automatic from signup order; this API is only for manually awarded badges such as **Theme Submitter**.

**Base URL:** `https://accounts.betterseqta.org`

## Authentication

Use the same Accounts API key as other interop endpoints:

```http
Authorization: Bearer <api_key>
```

or:

```http
X-API-Key: <api_key>
```

### Required scope

The key must include the scope **`badges:write`**.

Keys with **empty scopes** still have full access (legacy behaviour). For production integrations, create a dedicated key in **Admin → API Keys** with explicit scopes, for example:

```json
["badges:write", "badges:read", "users:read"]
```

Store the key in the calling service’s secrets (for example bsplus **External credentials → Accounts API key**). Never expose it in browser or client-side code.

---

## Award a badge

**`POST /api/v1/users/{userId}/badges`**

`userId` is the **theme submitter’s** BetterSEQTA Accounts user UUID (the `id` on their Cloud account from OAuth/login)—not a theme id, school SEQTA id, or submission id.

Idempotent: calling again for the same user and badge returns `created: false` without error.

### Request body

```json
{
  "badge_key": "theme_submitter"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `badge_key` | string | Yes | Achievement badge to grant. Currently: `theme_submitter`. |
| `userId` (path) | string | Yes | Theme submitter’s Accounts user UUID. |

### Response `200`

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "badge_key": "theme_submitter",
  "awarded": true,
  "created": true
}
```

| Field | Description |
|-------|-------------|
| `created` | `true` if a new row was inserted; `false` if the user already had this badge. |

### Error responses

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "badge_key is required" }` | Missing body field |
| `400` | `{ "error": "Invalid badge_key", "allowed": ["theme_submitter"] }` | Unknown or founder badge key |
| `401` | `{ "error": "Invalid or missing API key" }` | Bad or missing key |
| `403` | `{ "error": "API key missing required scope: badges:write" }` | Key lacks scope |
| `404` | `{ "error": "User not found" }` | Invalid theme submitter `userId` |

---

## Revoke a badge

**`DELETE /api/v1/users/{userId}/badges/{badge_key}`**

`userId` is the theme submitter’s Accounts user UUID.

Only achievement badges can be revoked via this API (not founder tiers).

### Response `200`

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "badge_key": "theme_submitter",
  "revoked": true
}
```

`revoked` is `false` if the user did not have the badge.

---

## Read badges (existing)

**`GET /api/v1/users/badges/{userId}`** — scope **`badges:read`**

Returns displayed badges (primary founder tier plus achievement badges):

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "badges": [
    { "key": "founder_2500", "label": "Founding Cloud", "awarded_at": 1710000000 },
    { "key": "theme_submitter", "label": "Theme Submitter", "awarded_at": 1710100000 }
  ]
}
```

User profile via **`GET /api/v1/users/{userId}/profile`** (scope **`users:read`**) includes the same `badges` array.

---

## Example: theme approved on BetterSEQTA.org

When a theme is accepted, POST using the **submitter’s Accounts `user.id`** stored on the theme/submission record.

```bash
curl -sS -X POST "https://accounts.betterseqta.org/api/v1/users/THEME_SUBMITTER_ACCOUNTS_USER_ID/badges" \
  -H "Authorization: Bearer YOUR_ACCOUNTS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"badge_key":"theme_submitter"}'
```

### Node (fetch)

```javascript
/** @param {string} themeSubmitterAccountsUserId Accounts UUID of the person who submitted the theme */
async function awardThemeSubmitterBadge(themeSubmitterAccountsUserId) {
  const res = await fetch(
    `https://accounts.betterseqta.org/api/v1/users/${themeSubmitterAccountsUserId}/badges`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ACCOUNTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ badge_key: "theme_submitter" }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}
```

---

## Badge reference

| `badge_key` | Label | When to award |
|-------------|-------|----------------|
| `theme_submitter` | Theme Submitter | Their submitted theme was accepted into the public theme gallery |

Founder badges (`founder_10` … `founder_2500`) are assigned automatically from signup order; do not POST them via this API.

For showing badges in a frontend (Theme Submitter UI, multiple badges per user), see [badges-client-integration.md](./badges-client-integration.md).
