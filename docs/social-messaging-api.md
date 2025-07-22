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

## Group Chats

### List Groups

**Endpoint:** `GET /api/messages`

**Description:** Returns a list of all group chats the user is a member of.

**Headers:**
- `Authorization: Bearer <token>`

**Example Response:**
```json
[
  {
    "id": 1,
    "name": "Cool Group",
    "iconUrl": null,
    "members": [
      { "id": 1, "displayName": "Alice" },
      { "id": 2, "displayName": "Bob" }
    ]
  },
  ...
]
```

---

## Create Group Chat

**Endpoint:** `POST /api/messages/create-group`

**Description:** Create a new group chat with a name and a list of member user IDs. The creator is automatically added as the group owner.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "name": "Cool Group",
  "memberIds": [2, 3, 4]
}
```

**Example Request:**
```http
POST /api/messages/create-group
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Cool Group",
  "memberIds": [2, 3, 4]
}
```

**Example Response:**
```json
{
  "id": 1,
  "name": "Cool Group",
  "members": [
    { "id": 1, "displayName": "Alice" },
    { "id": 2, "displayName": "Bob" },
    { "id": 3, "displayName": "Charlie" },
    { "id": 4, "displayName": "Dana" }
  ]
}
```

---

## Send a Message (DM or Group)

**Endpoint:** `POST /api/messages`

**Description:** Send a message to a friend (DM) or a group chat.

**Headers:**
- `Authorization: Bearer <token>`

**Body (DM):**
```json
{
  "receiverId": 2,
  "content": "Hello!"
}
```

**Body (Group):**
```json
{
  "groupId": 1,
  "content": "Hello group!"
}
```

**Optional fields:**
- `replyToId`: (number) ID of the message being replied to
- `attachmentId`: (number) ID of an uploaded file/image to attach

**Example Request (with attachment and reply):**
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiverId": 2,
  "content": "Check this out!",
  "replyToId": 123,
  "attachmentId": 456
}
```

**Example Response:**
```json
{
  "id": 789,
  "senderId": 1,
  "receiverId": 2,
  "content": "Check this out!",
  "read": false,
  "createdAt": "2024-06-23T12:00:00.000Z",
  "replyToId": 123,
  "attachmentId": 456
}
```

---

## Receive (Get) Messages (DM or Group)

**Endpoint:** `GET /api/messages/[id]`

**Description:** Get all messages between you and a specific friend (DM), or all messages in a group chat.

**Headers:**
- `Authorization: Bearer <token>`

**Example Request (DM):**
```http
GET /api/messages/2
Authorization: Bearer <token>
```

**Example Request (Group):**
```http
GET /api/messages/1
Authorization: Bearer <token>
```

**Example Response:**
```json
[
  {
    "id": 789,
    "senderId": 1,
    "receiverId": 2,
    "groupId": null,
    "content": "Check this out!",
    "read": true,
    "createdAt": "2024-06-23T12:00:00.000Z",
    "replyTo": { "id": 123, "content": "Original message..." },
    "attachment": {
      "id": 456,
      "filename": "cat.jpg",
      "storedName": "219d393656665f56.JPG",
      "mimeType": "image/jpeg",
      "size": 123456,
      "url": "/api/files/public/219d393656665f56.JPG"
    },
    "sender": { "id": 1, "username": "alice", "pfpUrl": null },
    "receiver": { "id": 2, "username": "johndoe", "pfpUrl": null }
  },
  ...
]
```

---

## File Upload (for Attachments)

**Endpoint:** `POST /api/files/upload`

**Description:** Upload a file or image to attach to a message. Returns the file's ID for use in `attachmentId`.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Body:**
- `file`: The file to upload (form field)

**File Size Limit:** 30MB

**Example Response:**
```json
{
  "id": 456,
  "filename": "cat.jpg",
  "storedName": "219d393656665f56.JPG",
  "mimeType": "image/jpeg",
  "size": 123456,
  "isPublic": true,
  "createdAt": "2024-06-23T12:00:00.000Z"
}
```

**Accessing Attachments:**
- Public files can be accessed at `/api/files/public/[storedName]` (no auth required)

---

## Markdown Support

- Message content supports Markdown formatting (bold, italic, code, links, lists, etc.).
- Use the Markdown toolbar in the UI to insert formatting.

---

## Message Replies

- You can reply to any message by specifying `replyToId` when sending a message.
- The UI shows a reply preview and quoted message context.

---

## UI/UX Notes

- You can send messages with only text, only an image, or both.
- Image attachments show a preview before sending.
- Reply buttons appear on hover for each message.
- Group chats and DMs are supported in the same interface.
- In group chats, each message includes the sender's username, displayName (if available), and pfpUrl. The frontend displays both the sender's profile picture and name above each message in group chats for clarity.
- All endpoints require authentication via a Bearer token.
- Only friends can send DMs to each other.
- File uploads are limited to 30MB and are public by default for message attachments. 