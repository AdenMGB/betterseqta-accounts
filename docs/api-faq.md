# BetterSEQTA+ Files API FAQ

This document addresses common questions and concerns about the Files API implementation.

## 🔐 API Authentication & User Management

### Q: Does the JWT token contain user ID information?
**A: Yes, absolutely!** The JWT token contains both user ID and email:

```typescript
// Token payload structure
{
  id: number,      // User ID
  email: string,   // User email
  iat: number,     // Issued at timestamp
  exp: number      // Expiration timestamp
}

// How to extract user ID from token
const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
const userId = decoded.id;
```

### Q: How do we identify which user uploaded a specific file?
**A: Every file is automatically associated with the authenticated user.** The API extracts the user ID from the JWT token and stores it in the `userId` field:

```typescript
// From upload endpoint
const fileRecord = await prisma.file.create({
  data: {
    userId: decoded.id,  // Automatically set from JWT token
    filename: originalFilename,
    // ... other fields
  }
});
```

### Q: Is there a way to get the current user's ID from the token?
**A: Yes, use the `/api/auth/me` endpoint:**

```typescript
const getCurrentUser = async (token: string) => {
  const response = await fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const user = await response.json();
  return user.id; // Returns user ID
};
```

### Q: Does the `/api/files/list` endpoint only return files belonging to the authenticated user?
**A: Yes, absolutely!** The endpoint automatically filters by user ownership:

```typescript
const where: any = {
  userId: decoded.id  // Only returns files for the authenticated user
};
```

### Q: Is there a userId field in the file response that we should be using?
**A: Yes!** The API now includes `userId` in all file responses for better client-side identification:

```typescript
interface File {
  id: number;
  userId: number;        // ✅ Now included
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  path: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 📁 File Management & Search

### Q: Why does the `/api/files/list?search=filename` endpoint return a 500 error?
**A: This was a MySQL compatibility issue that has been fixed.** The previous implementation used `mode: 'insensitive'` which is not supported in MySQL. The search now works correctly:

```typescript
// Fixed search implementation
if (search) {
  where.filename = {
    contains: search  // ✅ Now works correctly
  };
}
```

### Q: Are there alternative ways to search for specific files?
**A: Yes, the API supports multiple search options:**

```typescript
// Search by filename
GET /api/files/list?search=document

// Filter by MIME type
GET /api/files/list?mimeType=application/pdf

// Filter by public status
GET /api/files/list?isPublic=true

// Combine filters
GET /api/files/list?search=report&mimeType=application/pdf&isPublic=false
```

### Q: What happens if multiple users upload files with the same name?
**A: No conflicts occur!** Each file gets a unique `storedName`:

```typescript
// File naming strategy
const uniqueSuffix = randomBytes(8).toString('hex');
const fileExtension = path.extname(originalFilename);
const storedName = `${uniqueSuffix}${fileExtension}`;
// Example: "a1b2c3d4e5f6.pdf"
```

### Q: How do we handle file naming conflicts?
**A: Conflicts are impossible due to unique stored names:**

- **Original filename**: `desqta-settings.json` (preserved for display)
- **Stored filename**: `a1b2c3d4e5f6.json` (unique, prevents conflicts)
- **Multiple users can have the same original filename without issues**

### Q: Should we use unique identifiers in filenames?
**A: Not necessary!** The system handles uniqueness automatically:

```typescript
// ❌ Don't do this
filename: `desqta-settings-${userId}.json`

// ✅ Let the system handle it
filename: `desqta-settings.json`  // Original name preserved
storedName: `a1b2c3d4e5f6.json`   // Unique system name
```

## 🔒 Security & Access Control

### Q: Can users access files uploaded by other users?
**A: No, never!** All file operations are strictly filtered by user ownership:

```typescript
// Every file endpoint enforces user isolation
const where = {
  userId: decoded.id,  // Only user's own files
  // ... other filters
};
```

### Q: How is file privacy enforced?
**A: Multi-layered security approach:**

1. **JWT Authentication**: All requests require valid tokens
2. **User Isolation**: Database queries filter by `userId`
3. **File System Security**: Files stored with unique names
4. **Public Access Control**: Separate endpoint for public files only

### Q: Are there any public/shared file features?
**A: Yes!** Files can be made public:

```typescript
// Make file public
PATCH /api/files/{id}
{
  "isPublic": true
}

// Access public file (no auth required)
GET /api/files/public/{storedName}
```

### Q: How long do JWT tokens remain valid?
**A: 7 days by default:**

```typescript
const token = jwt.sign(
  { id: user.id, email: user.email }, 
  JWT_SECRET, 
  { expiresIn: '7d' }  // 7 days
);
```

### Q: What happens when a token expires during file operations?
**A: The API returns a 401 error:**

```typescript
// Standard error response
{
  statusCode: 401,
  statusMessage: "Invalid or expired token."
}
```

### Q: Is there a token refresh mechanism?
**A: Yes, use the OAuth endpoint:**

```typescript
// Refresh token
POST /api/oauth/token
Headers: { 'Authorization': 'Bearer {old-token}' }

// Response
{
  access_token: "new-token",
  token_type: "Bearer",
  expires_in: 604800  // 7 days in seconds
}
```

## 📊 API Response Format

### Q: Why was the userId field missing from the file list response?
**A: This was an oversight that has been fixed.** The `userId` field is now included in all file responses for better client-side identification and debugging.

### Q: Should we expect this field to be present in future API versions?
**A: Yes, absolutely!** The `userId` field will always be included going forward.

### Q: Are there any other fields we should be aware of?
**A: Here's the complete file response structure:**

```typescript
interface File {
  id: number;           // Unique file ID
  userId: number;       // Owner user ID
  filename: string;     // Original filename
  storedName: string;   // Unique system filename
  mimeType: string;     // File MIME type
  size: number;         // File size in bytes
  path: string;         // Public URL path
  isPublic: boolean;    // Public access flag
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
}
```

## ⚠️ Error Handling

### Q: What are the standard error response formats?
**A: Consistent error format across all endpoints:**

```typescript
interface APIError {
  statusCode: number;
  statusMessage: string;
}

// Common error codes:
// 400 - Bad Request (invalid parameters)
// 401 - Unauthorized (invalid/missing token)
// 404 - Not Found (file doesn't exist)
// 413 - Payload Too Large (file too big)
// 429 - Too Many Requests (rate limited)
// 500 - Internal Server Error
```

### Q: How should we handle rate limiting?
**A: The API includes rate limiting headers:**

```typescript
// Rate limit headers
{
  'X-RateLimit-Limit': '60',
  'X-RateLimit-Remaining': '45',
  'X-RateLimit-Reset': '1640995200',
  'Retry-After': '60'
}

// Handle 429 responses
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  // Retry the request
}
```

### Q: Are there specific error codes for different scenarios?
**A: Yes, here's a comprehensive list:**

```typescript
// Authentication errors
401 - "Missing or invalid token."
401 - "Invalid or expired token."

// File operation errors
400 - "No file uploaded."
400 - "Filename required."
400 - "Invalid file ID."
404 - "File not found."
404 - "File not found or not public."
413 - "File size exceeds limit."

// User operation errors
400 - "All fields are required."
409 - "Email already in use."
409 - "Username already in use."
404 - "User not found."

// Friend operation errors
400 - "Request ID is required."
404 - "Friend request not found."
409 - "Friend request already sent."
```

## 🚀 Best Practices

### 1. Token Management
```typescript
// Store token securely
localStorage.setItem('token', token);

// Include in all requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### 2. Error Handling
```typescript
const handleAPIError = (error: any) => {
  switch (error.statusCode) {
    case 401:
      // Redirect to login
      window.location.href = '/login';
      break;
    case 429:
      // Handle rate limiting
      setTimeout(() => retryRequest(), 60000);
      break;
    default:
      console.error('API Error:', error);
  }
};
```

### 3. File Upload
```typescript
// Validate file before upload
const validateFile = (file: File) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('File too large');
  }
  
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not allowed');
  }
};
```

### 4. Search Implementation
```typescript
// Debounced search
const debouncedSearch = debounce(async (query: string) => {
  const files = await api.listFiles({ search: query });
  // Update UI
}, 300);
```

This FAQ should address all your concerns about the Files API. The system is designed to be secure, scalable, and user-friendly while maintaining strict data isolation between users. 