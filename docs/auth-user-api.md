# Authentication & User Management API

This document provides comprehensive documentation for all authentication and user management endpoints in the BetterSeqta Accounts system.

## Overview

The API uses JWT (JSON Web Tokens) for authentication with a 7-day expiration. All protected endpoints require a Bearer token in the Authorization header.

**Base URL:** `https://accounts.betterseqta.org/api` (or `http://localhost:3000/api` for development)

## Authentication Flow

### 1. Register a New User

**Endpoint:** `POST /auth/register`

**Description:** Creates a new user account with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "username": "myusername",
  "displayName": "My Display Name"
}
```

**Response (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "username": "myusername",
  "displayName": "My Display Name",
  "pfpUrl": "https://api.dicebear.com/7.x/thumbs/svg?seed=a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `409 Conflict`: Email or username already in use

### 2. Login with Email and Password

**Endpoint:** `POST /auth/login`

**Description:** Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Missing email or password
- `401 Unauthorized`: Invalid credentials

### 3. Get Current User Information

**Endpoint:** `GET /auth/me`

**Description:** Returns the current authenticated user's information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "username": "myusername",
  "displayName": "My Display Name",
  "pfpUrl": "https://api.dicebear.com/7.x/thumbs/svg?seed=a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: User not found

### 4. Logout

**Endpoint:** `POST /auth/logout`

**Description:** Logs out the current user (client-side token removal required).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully. Please remove the token on the client."
}
```

## OAuth Authentication

### Discord OAuth

#### 1. Initiate Discord OAuth

**Endpoint:** `GET /oauth/discord`

**Description:** Redirects to Discord's OAuth authorization page.

**Response:** `302 Redirect` to Discord OAuth URL

#### 2. Discord OAuth Callback

**Endpoint:** `GET /oauth/discord/callback`

**Description:** Handles the OAuth callback from Discord and creates/updates user account.

**Query Parameters:**
- `code`: Authorization code from Discord

**Response:** `302 Redirect` to frontend with JWT token in query parameter

### 3. Token Exchange

**Endpoint:** `POST /oauth/token`

**Description:** Exchange credentials or existing JWT for a new access token (OAuth-style response).

**Request Options:**

**Option 1 - Using existing JWT:**
```
Authorization: Bearer <existing_jwt_token>
```

**Option 2 - Using email/password:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 604800
}
```

**Error Responses:**
- `400 Bad Request`: Missing credentials or token
- `401 Unauthorized`: Invalid credentials or expired token

## User Management

### 1. Update User Profile

**Endpoint:** `POST /user/update`

**Description:** Updates the current user's profile information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body (all fields optional):**
```json
{
  "displayName": "New Display Name",
  "username": "newusername",
  "pfpUrl": "https://example.com/new-avatar.jpg"
}
```

**Response (200 OK):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "username": "newusername",
  "displayName": "New Display Name",
  "pfpUrl": "https://example.com/new-avatar.jpg",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: No fields to update provided
- `401 Unauthorized`: Missing or invalid token
- `409 Conflict`: Username already in use

### 2. Get User Statistics

**Endpoint:** `GET /user/stats`

**Description:** Returns statistics about the current user's activity.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "friendsCount": 15,
  "messagesSent": 342,
  "messagesReceived": 298
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token

### 3. Get User Profile Picture

**Endpoint:** `GET /user/pfp`

**Description:** Returns a user's profile picture URL by their ID.

**Query Parameters:**
- `id`: User ID (UUID string)

**Example:** `GET /user/pfp?id=a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Response (200 OK):**
```json
{
  "pfpUrl": "https://api.dicebear.com/7.x/thumbs/svg?seed=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error Responses:**
- `400 Bad Request`: Missing user ID
- `404 Not Found`: User not found

## Authentication Headers

For all protected endpoints, include the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "statusCode": 400,
  "statusMessage": "Descriptive error message"
}
```

Common HTTP status codes:
- `200 OK`: Success
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or failed
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists

## User ID Format

All user IDs are UUIDs (Universally Unique Identifiers) in string format:
- Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

## Profile Pictures

- Default profile pictures are generated using DiceBear Avatars API
- Format: `https://api.dicebear.com/7.x/thumbs/svg?seed={userId}`
- Users can upload custom profile pictures via the update endpoint
- Profile pictures are served via the `/user/pfp` endpoint for consistent caching

## Security Notes

- JWT tokens expire after 7 days
- Passwords are hashed using bcrypt with 10 salt rounds
- OAuth providers (Discord) are supported for passwordless authentication
- All endpoints use HTTPS in production
- Rate limiting should be implemented at the reverse proxy level

## Example Usage

### JavaScript/TypeScript Example

```javascript
// Register a new user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword123',
    username: 'myusername',
    displayName: 'My Display Name'
  })
});

// Login and get token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword123'
  })
});
const { token } = await loginResponse.json();

// Use token for authenticated requests
const userResponse = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const user = await userResponse.json();

// Get user's profile picture
const pfpResponse = await fetch(`/api/user/pfp?id=${user.id}`);
const { pfpUrl } = await pfpResponse.json();
```

### cURL Examples

```bash
# Register
curl -X POST https://accounts.betterseqta.org/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123","username":"myuser","displayName":"My Name"}'

# Login
curl -X POST https://accounts.betterseqta.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'

# Get current user (replace TOKEN with actual JWT)
curl -H "Authorization: Bearer TOKEN" \
  https://accounts.betterseqta.org/api/auth/me

# Update profile
curl -X POST https://accounts.betterseqta.org/api/user/update \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"New Name"}'
``` 