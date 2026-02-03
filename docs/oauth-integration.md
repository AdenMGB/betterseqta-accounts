# OAuth 2.0 Integration Guide

BetterSEQTA Accounts provides an OAuth 2.0 provider service (Authorization Code Grant) to allow external applications (like `betterseqta.org`) to authenticate users.

## 1. Registration
To use the OAuth API, you must first register your application in the **Admin Dashboard** (`/admin`).
You will receive:
- **Client ID**
- **Client Secret** (Keep this secure!)
- **Redirect URI** (Must match exactly what is used in requests)

## 2. Authentication Flow

### Step A: Redirect User to Authorization Page
Redirect the user's browser to the authorization endpoint:

```
GET https://accounts.betterseqta.org/oauth/authorize
```

**Parameters:**
- `client_id`: Your Application's Client ID.
- `redirect_uri`: The URL to redirect back to after approval.
- `response_type`: Must be `code` (implied, not strictly enforced but good practice).

**Example:**
```
https://accounts.betterseqta.org/oauth/authorize?client_id=123-abc&redirect_uri=https://betterseqta.org/callback
```

### Step B: User Approves
The user logs in and approves the request. They are redirected back to your `redirect_uri` with a temporary code:

```
https://betterseqta.org/callback?code=AUTH_CODE_HERE
```

### Step C: Exchange Code for Access Token
Your server must exchange this code for an access token by making a POST request.

**Endpoint:** `POST https://accounts.betterseqta.org/api/oauth/token`

**Headers:** `Content-Type: application/json`

**Body:**
```json
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTH_CODE_FROM_STEP_B",
  "grant_type": "authorization_code",
  "redirect_uri": "YOUR_REDIRECT_URI"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUz...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "user-uuid",
    "username": "aden"
  }
}
```

### Step D: Fetch User Info
Use the access token to fetch the user's profile.

**Endpoint:** `GET https://accounts.betterseqta.org/api/oauth/userinfo`

**Headers:**
```
Authorization: Bearer <ACCESS_TOKEN>
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "username": "aden",
  "displayName": "Aden",
  "pfpUrl": "...",
  "is_admin": 1
}
```

## 3. Example Implementation (Node.js)

```javascript
const CLIENT_ID = '...';
const CLIENT_SECRET = '...';
const REDIRECT_URI = 'https://betterseqta.org/callback';

// 1. Redirect to Auth
app.get('/login', (req, res) => {
    const url = `https://accounts.betterseqta.org/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
    res.redirect(url);
});

// 2. Handle Callback
app.get('/callback', async (req, res) => {
    const { code } = req.query;

    // Exchange Code
    const tokenRes = await fetch('https://accounts.betterseqta.org/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI
        })
    });
    
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send('Error logging in');

    // Get User Info
    const userRes = await fetch('https://accounts.betterseqta.org/api/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const user = await userRes.json();
    
    // Log the user in to your app...
    req.session.user = user;
    res.redirect('/');
});
```

