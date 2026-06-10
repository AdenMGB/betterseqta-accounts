# Settings sync patching — client requirements

This document specifies what **DesQTA**, **BetterSEQTA+**, and the **Accounts web UI** must do after the accounts worker adopts sparse patch semantics on all three sync routes.

**Server behavior summary:**

| Route | Upload | Download |
|-------|--------|----------|
| `POST /api/settings` | Sparse top-level patch merged into stored JSON | — |
| `POST /api/settings/sync-init` | Optional `local.settings` baseline for diffing | Sparse patch when baseline provided; full doc for legacy clients |
| `PUT /api/bsplus/settings/sync` | Sparse `data` patch merged into stored JSON | — |
| `GET /api/settings` | — | Full hydrated document (only when row exists) |
| `GET /api/bsplus/settings/sync` | — | Full hydrated document |

**Patch semantics:** Top-level key merge only. Each key in the patch replaces that key in storage (arrays/objects replaced wholesale). Omitted keys are unchanged. Envelope keys (`ok`, `server`) and local-only keys are stripped server-side and never persisted.

---

## 1. DesQTA desktop

**Related:** [`docs/api-settings-sync-desqta.md`](./api-settings-sync-desqta.md), [`exampleSYNCJSONSchema/DesQTA.md`](../exampleSYNCJSONSchema/DesQTA.md)

### Upload — `POST /api/settings`

**Before:** Auto-save expanded `{ ...get_cloud_sync_settings(), ...patch }` (full 46-key snapshot on every change).

**After:**

1. Send **only the changed keys** from the local save patch.
2. Do **not** call `get_cloud_sync_settings()` to expand the upload body.
3. Keep full-schema upload only for:
   - First cloud bootstrap after `no_remote_settings`
   - Explicit admin “force full sync” action
4. Parse response: persist `server.settings_revision` / `server.settings_updated_at`; apply top-level keys excluding `ok`, `server`, and optional `patch` field via `save_settings_merge`.

**Example upload (theme change only):**

```json
{ "theme": "dark" }
```

### Download — `POST /api/settings/sync-init`

**Before:** On `server_has_newer`, response `settings` was the full cloud document.

**After:**

1. Include local baseline in sync-init body:

```json
{
  "client": { "app": "desqta", "platform": "desktop", "app_version": "1.0.0" },
  "local": {
    "settings_revision": 12,
    "settings": { "...": "get_cloud_sync_settings() output" }
  }
}
```

2. On `server_has_newer`:
   - If `settings_format === "patch"`: apply `settings` via `save_settings_merge({ patch: settings })` — **do not** treat as full replacement.
   - If `settings_format === "full"` or absent (legacy): apply as full document merge (existing behavior).
3. Empty patch `{}` with `server_has_newer` means server and local already match on all compared keys; still persist updated `server` revision metadata.

### Local initialization

No change required locally — `Settings::load()` already inserts missing keys. Server now mirrors this with lazy hydration on read/write.

---

## 2. BetterSEQTA+ extension

**Related:** [`exampleSYNCJSONSchema/BQ+.md`](../exampleSYNCJSONSchema/BQ+.md)

### Upload — `PUT /api/bsplus/settings/sync`

**Before:** `buildUploadPayload()` sent the entire filtered `chrome.storage.local` snapshot.

**After:**

1. Keep `ensureSyncableStorageDefaults()` **local-only** (complete local schema before diffing).
2. Track a **last-uploaded snapshot** (or per-key hash) after each successful PUT ack.
3. Build upload body as **sparse patch** — only keys that changed since last ack:

```json
{
  "schemaVersion": 1,
  "themeId": "uuid-or-empty",
  "data": {
    "DarkMode": true,
    "selectedTheme": "uuid"
  }
}
```

4. Debounced auto-upload sends the patch, not the full storage map.
5. On first upload (no cloud row), send keys that differ from schema defaults, or a minimal bootstrap patch.
6. Response may include `patch` (keys actually applied) and `updated_at`. Update local watermark after success.

**Breaking note:** Server **merges** `data` into existing storage. Sending a partial patch no longer deletes keys omitted from the body.

### Download — `GET /api/bsplus/settings/sync`

**Unchanged:** Server returns the **full hydrated** document for restore/manual download. Apply with existing `applyDownloadedEnvelope` semantics (merge into local storage, do not wipe omitted keys).

---

## 3. Accounts web UI (this repo)

### Changes implemented

| Area | Behavior |
|------|----------|
| Settings forms | `saveMode: 'sparse'` — `buildPayload()` returns diff only |
| Save handlers | Skip network call when patch is `{}` |
| Bootstrap (`app.vue`) | No full default dump on login; POST only if non-default patch needed |
| `useSettings.ts` | Unchanged API wrappers; callers pass sparse objects |

### Developer notes

- After load, form baseline = hydrated GET response.
- `commitSave(patch)` merges sparse patch into baseline after successful save.
- BS+ save uses `commitSave(payload)` instead of reloading full GET response.

---

## 4. Local-only keys (never upload)

### DesQTA

`cloud_settings_server_revision`, `cloud_settings_server_updated_at`, `last_synced_cloud_pfp_url`, `dashboard_widgets_layout`, `sidebar_recent_activity`, `ok`, `server`

### BetterSEQTA+

See `bsplusHiddenKeys` and `bsplusHiddenPrefixes` in [`utils/settings/bsplusSchema.ts`](../utils/settings/bsplusSchema.ts).

---

## 5. Rollout order

1. Deploy accounts worker (accepts both sparse and full uploads — full uploads are idempotent merges).
2. Update DesQTA and BS+ clients per sections above.
3. Accounts web UI sparse mode ships with worker deploy.

---

## 6. Verification checklist

- [ ] DesQTA auto-save POST body contains only changed keys (network tab).
- [ ] DesQTA sync-init includes `local.settings`; download applies patch when `settings_format: "patch"`.
- [ ] BS+ debounced PUT sends patch; keys not in patch remain on server after upload.
- [ ] Accounts settings save with no edits shows “No changes to save.”
- [ ] GET `/api/settings` for user with partial row returns all schema default keys after server hydration.
- [ ] POST identical patch twice does not bump DesQTA revision.
