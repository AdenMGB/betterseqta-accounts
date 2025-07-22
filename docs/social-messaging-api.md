# Social Messaging API

This document describes how to interact with the social messaging and friends features via the API endpoints in `server/api`.

## Friends List

**Endpoint:** `GET /api/friends`

**Description:** Returns a list of your accepted friends.

**Headers:**
- `Authorization: Bearer <token>`

**Example Request:**
```http
GET /api/friends
Authorization: Bearer <token>
```

**Example Response:**
```json
[
  {
    "id": 2,
    "username": "johndoe",
    "displayName": "John Doe",
    "pfpUrl": "https://..."
  },
  ...
]
```

---

## Send a Message

**Endpoint:** `POST /api/messages`

**Description:** Send a message to a friend.

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "receiverId": 2,
  "content": "Hello!"
}
```

**Example Request:**
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiverId": 2,
  "content": "Hello!"
}
```

**Example Response:**
```json
{
  "id": 123,
  "senderId": 1,
  "receiverId": 2,
  "content": "Hello!",
  "read": false,
  "createdAt": "2024-06-23T12:00:00.000Z"
}
```

---

## Receive (Get) Messages

**Endpoint:** `GET /api/messages/[userId]`

**Description:** Get all messages between you and a specific friend.

**Headers:**
- `Authorization: Bearer <token>`

**Example Request:**
```http
GET /api/messages/2
Authorization: Bearer <token>
```

**Example Response:**
```json
[
  {
    "id": 123,
    "senderId": 1,
    "receiverId": 2,
    "content": "Hello!",
    "read": true,
    "createdAt": "2024-06-23T12:00:00.000Z",
    "sender": { "id": 1, "username": "alice", "pfpUrl": null },
    "receiver": { "id": 2, "username": "johndoe", "pfpUrl": null }
  },
  ...
]
```

---

## Notes
- All endpoints require authentication via a Bearer token.
- Only friends can send messages to each other.
- Message objects include sender and receiver info when fetched. 