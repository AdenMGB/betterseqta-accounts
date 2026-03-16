# Export API Spec

API key–protected endpoints for exporting user and client data. Use the same API keys as the Discord stats API (create in Admin → API Keys).

**Base URL:** `https://accounts.betterseqta.org`

**Auth:** `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`

---

## GET /api/export/users/count

Returns total user count.

**Response:** `200 OK`

```json
{
  "total": 1234
}
```

---

## GET /api/export/reserved-clients

Returns count of reserved DesQTA client instances.

**Response:** `200 OK`

```json
{
  "count": 42
}
```

---

## GET /api/export/users/full

Returns full user table as JSON (password excluded).

**Response:** `200 OK`

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "displayName": "Display Name",
      "pfpUrl": "https://...",
      "admin_level": 0,
      "created_at": 1700000000
    }
  ],
  "count": 1234
}
```

---

## Error Responses

| Status | Body |
|-------|------|
| 401 | `{ "error": "Invalid or missing API key" }` |
| 500 | `{ "error": "...", "detail": "..." }` |
