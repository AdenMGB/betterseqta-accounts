# BetterSEQTA+ Files API Documentation

This document provides comprehensive information for third-party applications to integrate with the BetterSEQTA+ Files API for secure file management.

## 🔐 **Authentication**

All API endpoints (except public file downloads) require authentication using JWT tokens.

### **Headers Required**
```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### **Token Management**
- **Access Token**: Valid for 24 hours
- **Refresh Token**: Valid for 7 days
- **Auto-refresh**: Tokens are automatically refreshed when expired

## 📁 **File Storage Security**

The API uses a secure two-tier file storage system:

### **Private Files** (Default)
- **Location**: `data/users/{userId}/files/{storedName}`
- **Access**: Requires authentication + ownership verification
- **Security**: Completely isolated from web server

### **Public Files** (Explicitly Shared)
- **Location**: `public/uploads/{storedName}`
- **Access**: No authentication required
- **Security**: Only files explicitly marked as public

## 🚀 **API Endpoints**

### **1. Upload File**
```http
POST /api/files/upload
```

**Description**: Upload a new file (automatically private)

**Headers**:
```http
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body**: Form data with file field

**Response**:
```json
{
  "id": 1,
  "userId": 123,
  "filename": "document.pdf",
  "storedName": "a1b2c3d4e5f6.pdf",
  "mimeType": "application/pdf",
  "size": 1024000,
  "path": "/data/users/123/files/a1b2c3d4e5f6.pdf",
  "isPublic": false,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### **2. Download Private File**
```http
GET /api/files/{storedName}
```

**Description**: Download a private file (requires authentication)

**Headers**:
```http
Authorization: Bearer <token>
```

**Response**: File binary data with appropriate headers

### **3. Download Public File**
```http
GET /api/files/public/{storedName}
```

**Description**: Download a public file (no authentication required)

**Response**: File binary data with appropriate headers

### **4. List Files**
```http
GET /api/files?page=1&limit=10&search=document&isPublic=false
```

**Description**: List user's files with filtering and pagination

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search in filename
- `isPublic` (optional): Filter by public status (true/false)

**Response**:
```json
{
  "files": [
    {
      "id": 1,
      "userId": 123,
      "filename": "document.pdf",
      "storedName": "a1b2c3d4e5f6.pdf",
      "mimeType": "application/pdf",
      "size": 1024000,
      "path": "/data/users/123/files/a1b2c3d4e5f6.pdf",
      "isPublic": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### **5. Update File**
```http
PATCH /api/files/{id}
```

**Description**: Update file metadata or change public status

**Headers**:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Body**:
```json
{
  "filename": "new-name.pdf",
  "isPublic": true
}
```

**Response**: Updated file object

**Note**: Changing `isPublic` status will move the file between private and public directories

### **6. Delete File**
```http
DELETE /api/files/{id}
```

**Description**: Delete a file (removes from disk and database)

**Headers**:
```http
Authorization: Bearer <token>
```

**Response**:
```json
{
  "message": "File deleted successfully."
}
```

## 🔄 **File Lifecycle Examples**

### **Upload and Make Public**
```typescript
// 1. Upload file (automatically private)
const formData = new FormData();
formData.append('file', fileBlob);

const uploadedFile = await fetch('/api/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const file = await uploadedFile.json();
console.log('File uploaded:', file.path); // /data/users/123/files/a1b2c3d4e5f6.pdf

// 2. Make file public
const publicFile = await fetch(`/api/files/${file.id}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ isPublic: true })
});

const updatedFile = await publicFile.json();
console.log('File now public:', updatedFile.path); // /uploads/a1b2c3d4e5f6.pdf
```

### **Download Based on Status**
```typescript
// Download private file (requires auth)
const privateBlob = await fetch(`/api/files/${file.storedName}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Download public file (no auth required)
const publicBlob = await fetch(`/api/files/public/${file.storedName}`);
```

## 🛡️ **Security Features**

### **1. User Isolation**
- Files are stored in user-specific directories
- Database queries automatically filter by user ID
- Impossible to access other users' private files

### **2. Secure File Names**
- Files stored with unique, random names
- Original filenames preserved in database
- No filename conflicts between users

### **3. Explicit Public Sharing**
- Files are private by default
- Must be explicitly marked as public
- Public files moved to accessible directory

### **4. Authentication Required**
- All private operations require valid JWT token
- Token contains user ID for ownership verification
- Automatic user filtering on all endpoints

## 📊 **Error Handling**

### **Common Error Responses**

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "statusMessage": "Missing or invalid token."
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "statusMessage": "Access denied."
}
```

**404 Not Found**
```json
{
  "statusCode": 404,
  "statusMessage": "File not found."
}
```

**413 Payload Too Large**
```json
{
  "statusCode": 413,
  "statusMessage": "File too large."
}
```

**500 Internal Server Error**
```json
{
  "statusCode": 500,
  "statusMessage": "Internal server error."
}
```

## 🔧 **Integration Examples**

### **JavaScript/TypeScript**
```typescript
class BetterSEQTAFilesAPI {
  private token: string;
  private baseUrl: string;

  constructor(token: string, baseUrl: string = 'https://api.betterseqta.com') {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async downloadFile(storedName: string, isPublic: boolean = false): Promise<Blob> {
    const url = isPublic 
      ? `${this.baseUrl}/api/files/public/${storedName}`
      : `${this.baseUrl}/api/files/${storedName}`;

    const headers: Record<string, string> = {};
    if (!isPublic) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    return response.blob();
  }

  async listFiles(options: {
    page?: number;
    limit?: number;
    search?: string;
    isPublic?: boolean;
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.search) params.append('search', options.search);
    if (options.isPublic !== undefined) params.append('isPublic', options.isPublic.toString());

    const response = await fetch(`${this.baseUrl}/api/files?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`List failed: ${response.statusText}`);
    }

    return response.json();
  }

  async updateFile(id: number, updates: {
    filename?: string;
    isPublic?: boolean;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/files/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Update failed: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteFile(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }
}

// Usage
const api = new BetterSEQTAFilesAPI('your-jwt-token');

// Upload file
const file = await api.uploadFile(fileInput.files[0]);

// Make public
await api.updateFile(file.id, { isPublic: true });

// Download public file
const blob = await api.downloadFile(file.storedName, true);
```

### **Python**
```python
import requests
import json

class BetterSEQTAFilesAPI:
    def __init__(self, token, base_url="https://api.betterseqta.com"):
        self.token = token
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}

    def upload_file(self, file_path):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f"{self.base_url}/api/files/upload",
                headers=self.headers,
                files=files
            )
        response.raise_for_status()
        return response.json()

    def download_file(self, stored_name, is_public=False):
        if is_public:
            url = f"{self.base_url}/api/files/public/{stored_name}"
            headers = {}
        else:
            url = f"{self.base_url}/api/files/{stored_name}"
            headers = self.headers

        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.content

    def list_files(self, page=1, limit=10, search=None, is_public=None):
        params = {"page": page, "limit": limit}
        if search:
            params["search"] = search
        if is_public is not None:
            params["isPublic"] = str(is_public).lower()

        response = requests.get(
            f"{self.base_url}/api/files",
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()

    def update_file(self, file_id, filename=None, is_public=None):
        data = {}
        if filename:
            data["filename"] = filename
        if is_public is not None:
            data["isPublic"] = is_public

        response = requests.patch(
            f"{this.base_url}/api/files/{file_id}",
            headers={**self.headers, "Content-Type": "application/json"},
            json=data
        )
        response.raise_for_status()
        return response.json()

    def delete_file(self, file_id):
        response = requests.delete(
            f"{this.base_url}/api/files/{file_id}",
            headers=self.headers
        )
        response.raise_for_status()

# Usage
api = BetterSEQTAFilesAPI("your-jwt-token")

# Upload file
file_info = api.upload_file("document.pdf")

# Make public
updated_file = api.update_file(file_info["id"], is_public=True)

# Download public file
file_content = api.download_file(file_info["storedName"], is_public=True)
```

## 📋 **Best Practices**

### **1. Error Handling**
- Always check response status codes
- Implement retry logic for network errors
- Handle token expiration gracefully

### **2. File Management**
- Use appropriate file types and sizes
- Implement progress indicators for uploads
- Cache file metadata to reduce API calls

### **3. Security**
- Never store tokens in client-side code
- Use HTTPS for all API calls
- Validate file types on client side

### **4. Performance**
- Use pagination for large file lists
- Implement file caching strategies
- Use appropriate chunk sizes for uploads

## 🔍 **Debugging**

### **Debug Endpoint**
```http
GET /api/files/debug/list
```

**Description**: List all files in both private and public directories (requires authentication)

**Response**:
```json
{
  "userId": 123,
  "directories": {
    "private": {
      "path": "/path/to/data/users/123/files",
      "totalFiles": 5,
      "files": [...]
    },
    "public": {
      "path": "/path/to/public/uploads",
      "totalFiles": 2,
      "files": [...]
    }
  }
}
```

This comprehensive API provides secure, scalable file management with proper access controls and user isolation. 