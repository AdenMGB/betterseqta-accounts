# BetterSeqta Social Messaging & Friends API

This document provides a comprehensive guide to the social, friends, messaging, group, and file APIs for BetterSeqta. It covers authentication, friends management, group chats, direct messages, file attachments, pagination, profile picture handling, and frontend caching strategies (including IndexedDB).

---

## Authentication
All endpoints require authentication via a Bearer token in the `Authorization` header.

---

## Friends System

### List Friends
**Endpoint:** `GET /api/friends`

Returns a list of your accepted friends.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "id": "uuid",
    "username": "johndoe",
    "displayName": "John Doe"
  },
  ...
]
```

---

### Send Friend Request
**Endpoint:** `POST /api/friends/request`

Send a friend request by username.

**Body:**
```json
{ "username": "targetUsername" }
```

**Response:**
```json
{ "id": "uuid", "requesterId": "uuid", "addresseeId": "uuid", "status": "PENDING" }
```

---

### List Pending Friend Requests
**Endpoint:** `GET /api/friends/requests`

Returns all pending friend requests sent to you.

**Response:**
```json
[
  { "id": "uuid", "requester": { "id": "uuid", "username": "alice", "displayName": "Alice" } },
  ...
]
```

---

### Accept/Reject/Remove Friend
**Accept:** `POST /api/friends/accept`  
**Reject:** `POST /api/friends/reject`  
**Remove:** `POST /api/friends/remove`

**Body:**
```json
{ "requestId": "uuid" } // for accept/reject
{ "friendId": "uuid" }   // for remove
```

**Response:**
```json
{ "success": true }
```

---

## Group Chats

### List Groups
**Endpoint:** `GET /api/groups`

Returns all group chats the user is a member of.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Cool Group",
    "iconUrl": null,
    "members": [ { "id": "uuid", "displayName": "Alice" }, ... ]
  },
  ...
]
```

---

### Create Group
**Endpoint:** `POST /api/groups`

**Body:**
```json
{ "name": "Cool Group", "memberIds": ["uuid1", "uuid2"] }
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Cool Group",
  "members": [ { "id": "uuid", "displayName": "Alice" }, ... ]
}
```

---

## Direct & Group Messaging

### Send a Message
**Endpoint:** `POST /api/messages/[chatId]`

Send a message to a group or DM. Use the chat/group/user UUID as the route param.

**Body:**
```json
{
  "content": "Hello!",
  "replyToId": "uuid",      // optional
  "attachmentId": "uuid"    // optional
}
```

**Response:**
```json
{
  "id": "uuid",
  "senderId": "uuid",
  "receiverId": "uuid", // for DMs
  "groupId": "uuid",    // for groups
  "content": "Hello!",
  "read": false,
  "createdAt": "2024-06-23T12:00:00.000Z",
  "replyToId": null,
  "attachmentId": null,
  "sender": { "id": "uuid", "username": "alice" },
  "group": { "id": "uuid", "name": "Cool Group" },
  "replyTo": null,
  "attachment": null
}
```

---

### Get Messages (Paginated)
**Endpoint:** `GET /api/messages/[chatId]?page=1`

Returns messages for a group or DM, paginated (default: 25 per page, newest first).

**Response:**
```json
[
  {
    "id": "uuid",
    "senderId": "uuid",
    "receiverId": "uuid",
    "groupId": null,
    "content": "Hello!",
    "read": true,
    "createdAt": "2024-06-23T12:00:00.000Z",
    "replyToId": null,
    "attachmentId": null,
    "sender": { "id": "uuid", "username": "alice" },
    "group": { "id": "uuid", "name": "Cool Group" },
    "replyTo": null,
    "attachment": null
  },
  ...
]
```

**Pagination:**
- Use the `?page=` query parameter to load older messages (page 1 = newest, page 2 = next 25 older, etc.).
- The API returns messages in reverse chronological order; the frontend should reverse them for display.

---

## File Uploads & Attachments

### Upload File
**Endpoint:** `POST /api/files/upload`

**Body:**
- `file`: The file to upload (multipart/form-data)

**Response:**
```json
{
  "id": "uuid",
  "filename": "cat.jpg",
  "storedName": "219d393656665f56.JPG",
  "mimeType": "image/jpeg",
  "size": 123456,
  "isPublic": true,
  "createdAt": "2024-06-23T12:00:00.000Z"
}
```

**Access:**
- Public files: `/api/files/public/[storedName]`

---

## Profile Pictures (pfpUrl)

### Get Profile Picture URL
**Endpoint:** `GET /api/user/pfp?id=<userId>`

Returns the profile picture URL for a user. If not set, returns a DiceBear avatar URL.

**Response:**
```json
{ "pfpUrl": "https://..." }
```

**Frontend Usage:**
- Fetch and cache pfp URLs as needed (see IndexedDB section below).

---

## Frontend Caching & IndexedDB Strategy

### Why Use IndexedDB?
- LocalStorage is limited (~5MB) and not suitable for large chat histories.
- IndexedDB allows you to cache large numbers of messages per chat, improving performance and offline support.

### How to Use (with idb-keyval)
- On chat load, fetch messages from IndexedDB first (keyed by `messages-<chatId>`).
- When fetching from the API, merge new messages into the cache, avoiding duplicates.
- When loading older messages (pagination), prepend them to the cached array.
- Always update the UI from the cache.
- Example (Vue):
```js
import { set, get } from 'idb-keyval'

const loadMessagesFromCache = async (chatId) => {
  return (await get(`messages-${chatId}`)) || []
}
const saveMessagesToCache = async (chatId, messages) => {
  await set(`messages-${chatId}`, messages)
}
```

---

## UI/UX Notes
- The frontend should always scroll to the bottom when entering a chat.
- Use a "Load older messages" button or infinite scroll to fetch previous pages.
- Profile pictures are fetched on demand and cached.
- All endpoints require authentication.
- Only friends can DM each other.
- Markdown is supported in message content.
- File uploads are public by default for message attachments.

---

## Example Workflow
1. User logs in and fetches friends/groups.
2. User enters a chat:
   - Messages are loaded from IndexedDB cache.
   - Latest messages are fetched from the API and merged.
   - UI scrolls to the bottom.
3. User scrolls up and clicks "Load older messages":
   - The next page is fetched and prepended to the cache/UI.
4. User sends a message:
   - The message is optimistically added to the cache/UI.
   - The API is called to persist the message.
5. Profile pictures are fetched as needed and cached.

---

## Security & Best Practices
- Always use HTTPS in production.
- Validate all user input on both frontend and backend.
- Use JWT tokens for authentication.
- Limit file upload size (30MB max).
- Sanitize Markdown to prevent XSS.

---

For further details, see the codebase or ask for specific endpoint examples! 