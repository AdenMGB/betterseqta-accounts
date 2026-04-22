# User Contact Export API

Export user emails and display names from BetterSEQTA Accounts using an API key. Intended for newsletters, contact lists, and external integrations.

**Base URL:** `https://accounts.betterseqta.org`

---

## Authentication

All requests to this endpoint require a valid API key. Keys are created in the admin dashboard under **Admin → API Keys**.

Two header formats are accepted — use whichever suits your integration:

```http
Authorization: Bearer <api_key>
```

```http
X-API-Key: <api_key>
```

API keys look like:

```
bs_a1b2c3d4e5f6...  (64 hex chars after the prefix)
```

> **Keep your API key secret.** Anyone with the key can read all user emails. Do not commit it to version control or expose it client-side.

---

## Creating an API Key

1. Log in to the admin dashboard at `https://accounts.betterseqta.org`
2. Go to **Admin → API Keys**
3. Click **Create Key** and give it a descriptive name (e.g. `mailchimp-sync`)
4. Copy the token immediately — it is only shown once

---

## Endpoint

### `GET /api/export/users/contact`

Returns a paginated list of every user's email address and display name.

#### Query Parameters

| Parameter | Type    | Default | Max   | Description                      |
|-----------|---------|---------|-------|----------------------------------|
| `page`    | integer | `1`     | —     | Page number, 1-indexed           |
| `limit`   | integer | `1000`  | `5000`| Number of records per page       |

#### Response `200 OK`

```json
{
  "users": [
    { "email": "alice@example.com", "displayName": "Alice Smith" },
    { "email": "bob@example.com",   "displayName": "Bob Jones" }
  ],
  "count": 2,
  "total": 4200,
  "page": 1,
  "limit": 1000,
  "totalPages": 5
}
```

| Field        | Type    | Description                                      |
|--------------|---------|--------------------------------------------------|
| `users`      | array   | Records for the current page                     |
| `count`      | integer | Number of records returned on this page          |
| `total`      | integer | Total users across all pages                     |
| `page`       | integer | Current page number                              |
| `limit`      | integer | Records per page used for this request           |
| `totalPages` | integer | Total number of pages at the current limit       |

#### Error Responses

| Status | Body                                               | Cause                        |
|--------|----------------------------------------------------|------------------------------|
| `401`  | `{ "error": "Invalid or missing API key" }`        | Missing, invalid, or revoked key |
| `500`  | `{ "error": "...", "detail": "..." }`              | Database error               |

---

## Examples

### cURL — first page (default 1 000 records)

```bash
curl -H "Authorization: Bearer bs_YOUR_API_KEY" \
  "https://accounts.betterseqta.org/api/export/users/contact"
```

### cURL — custom page size

```bash
curl -H "Authorization: Bearer bs_YOUR_API_KEY" \
  "https://accounts.betterseqta.org/api/export/users/contact?limit=500&page=2"
```

### JavaScript — fetch all users across all pages

```js
async function fetchAllContacts(apiKey) {
  const base = "https://accounts.betterseqta.org/api/export/users/contact";
  const limit = 1000;
  let page = 1;
  let allUsers = [];

  while (true) {
    const res = await fetch(`${base}?page=${page}&limit=${limit}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });

    if (!res.ok) throw new Error(`Request failed: ${res.status}`);

    const data = await res.json();
    allUsers = allUsers.concat(data.users);

    if (page >= data.totalPages) break;
    page++;
  }

  return allUsers; // [{ email, displayName }, ...]
}
```

### Python — fetch all users across all pages

```python
import requests

def fetch_all_contacts(api_key: str) -> list[dict]:
    base = "https://accounts.betterseqta.org/api/export/users/contact"
    headers = {"Authorization": f"Bearer {api_key}"}
    page, limit = 1, 1000
    all_users = []

    while True:
        r = requests.get(base, headers=headers, params={"page": page, "limit": limit})
        r.raise_for_status()
        data = r.json()
        all_users.extend(data["users"])
        if page >= data["totalPages"]:
            break
        page += 1

    return all_users  # [{"email": ..., "displayName": ...}, ...]
```

---

## Notes

- Emails are stored and returned in lowercase.
- Results are ordered by account creation date (oldest first).
- The maximum `limit` per request is `5000`. For larger datasets use pagination.
- Passwords and internal fields are never included in this response.
- If your key is revoked in **Admin → API Keys**, all requests with that key will immediately return `401`.
