# Timetable classmates — phonebook + relay (accounts API)

BetterSEQTA+ classmate avatars use **two layers**:

1. **Phonebook (REST, D1)** — who opted in per SEQTA `instance_host` (ids + identity binding). No timetable data.
2. **Class relay (Durable Object + WebSocket)** — opaque, encrypted class-enrollment blobs keyed by `classRosterKey`. Fan-out hub only.

SEQTA direct messages are **not** used. **`GET .../sync-hint` is not implemented** (legacy DM design).

Base URL: `https://accounts.betterseqta.org`

Auth: `Authorization: Bearer <bsplus access token>` on all REST routes.

Implementation: `worker/src/routes/timetable-classmates-bsplus.ts`, `worker/src/durable-objects/timetable-classmates-relay.ts`.

---

## Phonebook

| Method | Path |
|--------|------|
| PUT | `/api/bsplus/timetable-classmates/opt-in` |
| DELETE | `/api/bsplus/timetable-classmates/opt-in?instance_host=` |
| GET | `/api/bsplus/timetable-classmates/peers?instance_host=` |
| POST | `/api/bsplus/timetable-classmates/heartbeat` |

Opt-in and heartbeat require `identity_binding_digest` (SHA-256 hex, v1 canonical string), `identity_binding_version: 1`, and SEQTA ids. See [api-reference.md](./api-reference.md).

REST opt-out also removes the caller’s share from the instance relay (internal DO revoke).

---

## Relay session

### `GET /api/bsplus/timetable-classmates/relay-session?instance_host=...`

**200**

```json
{
  "ws_url": "wss://accounts.betterseqta.org/api/bsplus/timetable-classmates/relay/ws",
  "relay_token": "<JWT, 15 min>",
  "bundle_key_b64": "<32 random bytes, base64>",
  "share_code": "<8 hex chars>",
  "relay_protocol": 1
}
```

- **`relay_token`**: JWT claims only `instance_host`, `cloud_user_id`, `seqta_student_id`, `share_code` (no bundle key — token appears in WebSocket query string).
- **`bundle_key_b64`**: session-only AES root; never stored on server or embedded in JWT.
- **`share_code`**: first 8 hex chars of `identity_binding_digest`.

**401** · **404** not opted in · **422** bad host or missing binding.

---

## WebSocket

### Upgrade

`GET {ws_url}?instance_host=<host>&relay_token=<JWT>`

Worker validates JWT + active D1 membership, forwards to Durable Object `TimetableClassmatesRelay` named by `instance_host`.

### Wire format (JSON text frames, `"v": 1`)

**Server → client `snapshot`** (on connect; after each `publish` / `revoke`):

```json
{
  "v": 1,
  "type": "snapshot",
  "shares": [
    {
      "seqta_student_id": 3111,
      "cloud_user_id": "uuid",
      "share_code": "083f5e95",
      "period": { "from": "2026-01-01", "until": "2026-12-31" },
      "updated_at": 1730000000000,
      "bundles": [{ "class_key": "cr:v1:14774", "iv_b64": "...", "ct_b64": "..." }]
    }
  ]
}
```

**Client → server `publish`** — replaces caller’s share:

```json
{
  "v": 1,
  "type": "publish",
  "period": { "from": "...", "until": "..." },
  "bundles": [{ "class_key": "...", "iv_b64": "...", "ct_b64": "..." }]
}
```

**Client → server `revoke`:**

```json
{ "v": 1, "type": "revoke" }
```

**Server → client `error`:**

```json
{ "v": 1, "type": "error", "message": "..." }
```

---

## Encryption (client-side)

Relay stores only `iv_b64` + `ct_b64`. Plaintext per class bundle:

```json
{
  "v": 1,
  "seqta_student_id": 3111,
  "person_uuid": "...",
  "cloud_user_id": "...",
  "class": { "metaID": 14774 }
}
```

Pipeline: JSON → deflate → AES-256-GCM.

Per-class key (v1):

```
key = SHA-256( bundle_key || "|" || "tq-v1:" || class_key )
```

`bundle_key` from relay-session only; rotates each session.

---

## Client sync flow

1. Heartbeat (REST).
2. `GET peers` → allow-list.
3. `GET relay-session` → `bundle_key_b64`, `relay_token`, `ws_url`.
4. WebSocket → `snapshot` → decrypt → merge roster.
5. Local timetable → encrypt bundles → `publish`.
6. Close socket (optional: keep open on timetable tab).

Opt-out: `revoke` on WS if connected, then `DELETE opt-in` (server purges relay share either way).

---

## Deployment

`wrangler.toml`:

- `[[durable_objects.bindings]]` → `TIMETABLE_CLASSMATES_RELAY`
- `[[migrations]]` with `new_sqlite_classes = ["TimetableClassmatesRelay"]` (SQLite-backed DO; required for new namespaces)
- Export `TimetableClassmatesRelay` from `worker/src/index.ts`

---

## Privacy

- **D1:** instance, SEQTA ids, cloud user id, binding digest, timestamps.
- **DO:** ciphertext + share headers (`seqta_student_id`, `share_code`, `cloud_user_id`). No class names in metadata.
