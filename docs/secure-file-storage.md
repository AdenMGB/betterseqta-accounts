# Secure File Storage System

This document explains the secure file storage implementation for the BetterSEQTA+ Files API.

## 🔒 **Security Overview**

The file storage system uses a two-tier approach to ensure proper access control:

### **Private Files** (Default)
- **Location**: `data/users/{userId}/files/{storedName}`
- **Access**: Requires authentication token
- **Security**: Completely isolated from web server
- **Example**: `data/users/1/files/a1b2c3d4e5f6.json`

### **Public Files** (Explicitly Shared)
- **Location**: `public/uploads/{storedName}`
- **Access**: No authentication required
- **Security**: Only files explicitly marked as public
- **Example**: `public/uploads/a1b2c3d4e5f6.json`

## 📁 **Directory Structure**

```
project-root/
├── data/
│   └── users/
│       ├── 1/
│       │   └── files/
│       │       ├── a1b2c3d4e5f6.json
│       │       └── b2c3d4e5f6g7.pdf
│       └── 2/
│           └── files/
│               └── c3d4e5f6g7h8.jpg
├── public/
│   └── uploads/
│       └── d4e5f6g7h8i9.png (public files only)
└── server/
    └── api/
        └── files/
```

## 🔄 **File Lifecycle**

### 1. **Upload** (Always Private Initially)
```typescript
// File uploaded to: data/users/{userId}/files/{storedName}
// Database record: isPublic = false, path = "/data/users/{userId}/files/{storedName}"
```

### 2. **Download** (Based on Public Status)
```typescript
// Private files: /api/files/{storedName} (requires auth)
// Public files: /api/files/public/{storedName} (no auth)
```

### 3. **Make Public** (Moves File)
```typescript
// File moved from: data/users/{userId}/files/{storedName}
// File moved to: public/uploads/{storedName}
// Database updated: isPublic = true, path = "/uploads/{storedName}"
```

### 4. **Make Private** (Moves File Back)
```typescript
// File moved from: public/uploads/{storedName}
// File moved to: data/users/{userId}/files/{storedName}
// Database updated: isPublic = false, path = "/data/users/{userId}/files/{storedName}"
```

## 🛡️ **Security Features**

### **1. User Isolation**
- Each user's files are stored in separate directories
- Impossible for users to access other users' private files
- Database queries filter by `userId`

### **2. Authentication Required**
- All private file operations require valid JWT token
- Token contains user ID for ownership verification
- Automatic user filtering on all endpoints

### **3. Secure File Names**
- Files stored with unique, random names
- Original filenames preserved in database
- No filename conflicts between users

### **4. Explicit Public Sharing**
- Files are private by default
- Must be explicitly marked as public
- Public files moved to accessible directory

## 📊 **API Endpoints**

### **Upload File**
```typescript
POST /api/files/upload
// Saves to: data/users/{userId}/files/{storedName}
// Sets: isPublic = false
```

### **Download Private File**
```typescript
GET /api/files/{storedName}
// Reads from: data/users/{userId}/files/{storedName}
// Requires: Authorization header
```

### **Download Public File**
```typescript
GET /api/files/public/{storedName}
// Reads from: public/uploads/{storedName}
// Requires: No authentication
```

### **Make File Public**
```typescript
PATCH /api/files/{id}
{
  "isPublic": true
}
// Moves file from private to public directory
```

### **Make File Private**
```typescript
PATCH /api/files/{id}
{
  "isPublic": false
}
// Moves file from public to private directory
```

### **Delete File**
```typescript
DELETE /api/files/{id}
// Deletes from appropriate directory based on isPublic status
```

## 🔧 **Migration from Old System**

If you have existing files in the old `public/uploads` directory, run the migration script:

```bash
node scripts/migrate-files.js
```

This will:
1. Move all existing files to `data/users/{userId}/files/`
2. Update database records with new paths
3. Set all files to private (`isPublic = false`)

## 🚀 **Benefits**

### **Security**
- ✅ Complete user isolation
- ✅ No unauthorized access to private files
- ✅ Explicit public sharing only
- ✅ Secure file naming

### **Performance**
- ✅ Fast file access
- ✅ Efficient directory structure
- ✅ Minimal disk I/O

### **Scalability**
- ✅ Easy to backup user data
- ✅ Simple to implement quotas
- ✅ Clear separation of concerns

## 📝 **Usage Examples**

### **Upload and Download**
```typescript
// Upload file (automatically private)
const uploadedFile = await api.uploadFile(file);
console.log('File uploaded to:', uploadedFile.path);

// Download private file
const blob = await api.downloadFile(uploadedFile.storedName);

// Make file public
const publicFile = await api.updateFile(uploadedFile.id, { isPublic: true });
console.log('File now public at:', publicFile.path);

// Download public file (no auth required)
const publicBlob = await api.downloadPublicFile(publicFile.storedName);
```

### **File Management**
```typescript
// List all files (private and public)
const files = await api.listFiles();

// List only private files
const privateFiles = await api.listFiles({ isPublic: false });

// List only public files
const publicFiles = await api.listFiles({ isPublic: true });
```

This secure file storage system ensures that user data is properly protected while still allowing for controlled public sharing when needed. 