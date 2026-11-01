# BetterSEQTA+ — Profile picture API

Hosted profile pictures are stored on BetterSEQTA Accounts (Cloudflare R2), served from `/api/user/pfp/{userId}`, and may enter **admin review** after upload.

**Base URL:** `https://accounts.betterseqta.org`

**Auth:** `Authorization: Bearer <access_token>` from [login / refresh](./api-reference.md) (same JWT as other BS+ routes).

Implementation: `worker/src/routes/pfp-bsplus.ts`, `worker/src/lib/pfpUploadHandler.ts`, `worker/src/lib/pfpProcess.ts`.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bsplus/pfp` | Current `pfpUrl`, `pfpHash`, and `pfpHistory` |
| POST | `/api/bsplus/pfp` | Upload new profile picture (multipart) |
| GET | `/api/bsplus/pfp/history` | Past profile pictures only |
| POST | `/api/bsplus/pfp/clear` | Remove current picture (keeps history) |
| POST | `/api/bsplus/pfp/revert` | Restore a past picture by `historyId` |

Rate limits (per user): **60 uploads / hour**, **30 clear or revert / hour**.

Errors: `{ "error": "message" }` with appropriate HTTP status.

---

## GET `/api/bsplus/pfp`

**200**

```json
{
  "pfpUrl": "https://accounts.betterseqta.org/api/user/pfp/867bdc13-fe1b-4478-91ab-ef46c02253b8",
  "pfpHash": "a1b2c3…64 hex…",
  "pfpHistory": [
    {
      "id": "uuid",
      "r2Key": "https://accounts.betterseqta.org/api/user/pfp/{userId}/hist/{id}",
      "createdAt": 1730000000000
    }
  ]
}
```

- **`pfpUrl`** — Canonical URL for the **current** picture (use in UI). `null` if cleared.
- **`pfpHash`** — SHA-256 hex of stored WebP bytes; use for cache busting (`?v=` or `If-None-Match` on image GET).
- **`pfpHistory`** — Up to **3** past slots (newest first). Empty array if none.

**401** — Missing or invalid token.

---

## POST `/api/bsplus/pfp`

Upload replaces the current picture. The previous current image is moved into history (oldest past slot dropped when full).

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | **512×512** WebP or JPEG prepared in the client |
| `clientProcessed` | string | **Yes** | Must be `"true"` — Worker does not run image encoding (Cloudflare CPU limits) |
| `preCropped` | string | No | Set to `"true"` when already square (recommended) |

**200**

```json
{
  "pfpUrl": "https://accounts.betterseqta.org/api/user/pfp/{userId}",
  "pfpHash": "…",
  "pfpHistory": [ … ]
}
```

**400** — Missing file, invalid type, or over size limit (max **20MB** on server).  
**401** — Unauthorized.  
**429** — Rate limit.  
**500** — Storage or unexpected failure.

### Server behavior

The Worker **does not decode or re-encode** uploads. It validates WebP/JPEG magic bytes, stores bytes in R2, updates `pfp_hash`, and sets `pfp_pending_review` for the audit queue.

All resize/crop/WebP encoding must happen **in the extension or browser** before upload.

---

## GET `/api/bsplus/pfp/history`

**200:** `{ "pfpHistory": [ … ] }` — same shape as the `pfpHistory` array on GET `/api/bsplus/pfp`.

---

## POST `/api/bsplus/pfp/clear`

No body required.

**200:** `{ "pfpUrl": null, "pfpHash": null, "pfpHistory": [ … ] }`

---

## POST `/api/bsplus/pfp/revert`

**JSON body:**

```json
{ "historyId": "uuid-from-pfpHistory" }
```

**200:** Same as upload — new `pfpUrl`, `pfpHash`, updated `pfpHistory`.

**404** — Unknown `historyId` or missing R2 object.

---

## Serving images (read-only)

Clients usually **do not** call BS+ routes to display avatars. Use URLs from `pfpUrl` / `pfpHistory[].r2Key`:

| Resource | URL pattern |
|----------|-------------|
| Current | `GET /api/user/pfp/{userId}` |
| Past | `GET /api/user/pfp/{userId}/hist/{historyId}` |
| Hash only | `GET /api/user/pfp/{userId}/meta` → `{ "pfpHash" }` |

**Caching:** Responses include `ETag` / `X-Pfp-Hash` on the current slot. Send `If-None-Match: "{pfpHash}"` for **304** when unchanged.

**Content-Type:** `image/webp` for newly processed uploads.

---

## Client implementation notes (BetterSEQTA+)

### Auth

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs…
```

Obtain the access token via `POST /api/bsplus/login` or `POST /api/bsplus/refresh` ([api-reference](./api-reference.md)).

### Recommended upload flow

1. Let the user pick any image (PNG, JPEG, HEIC where the browser can decode, WebP, etc.).
2. **Crop to a square** in the extension (required for predictable framing).
3. Export **512×512** **WebP** from a canvas when supported; otherwise JPEG.
4. Enforce size **before** upload:
   - **20MB** max source file when WebP export is available
   - **10MB** max when WebP is not supported (legacy browsers)
5. `POST` multipart with `clientProcessed=true` and `preCropped=true`.

Example (extension / fetch):

```typescript
const form = new FormData();
form.append("file", croppedFile, croppedFile.name);
form.append("clientProcessed", "true");
form.append("preCropped", "true");

const res = await fetch("https://accounts.betterseqta.org/api/bsplus/pfp", {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
  body: form,
});
const data = await res.json();
// data.pfpUrl, data.pfpHash — update local user state + cache bust avatars
```

### After upload

- Update stored user `pfpUrl` and cache key from `pfpHash`.
- Peers load avatars via `/api/user/pfp/{userId}` (no auth required for GET image).
- Hosted uploads may show as **pending review** in admin; the image is still served unless removed by moderators.

### Equivalent web routes

The accounts website uses the same backend via cookie or Bearer on:

- `POST /api/user/pfp` — upload (identical processing)

BS+ clients should prefer **`/api/bsplus/pfp`** for consistent naming with other extension APIs.

---

## Related docs

- [API reference — login & refresh](./api-reference.md)
- [Auth & user API](../auth-user-api.md) (legacy `/api/user/*` paths)
