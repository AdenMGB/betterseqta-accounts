# Token Management Guide

This guide covers JWT token management, refresh mechanisms, and security best practices for the BetterSEQTA+ API.

## 🔐 JWT Token Structure

### Token Payload
```typescript
interface JWTPayload {
  id: number;        // User ID
  email: string;     // User email
  iat: number;       // Issued at timestamp
  exp: number;       // Expiration timestamp
}
```

### Token Lifetime
- **Default**: 7 days
- **Refreshable**: Yes, via OAuth endpoint
- **Auto-refresh**: Recommended before expiration

## 🔄 Token Refresh

### Method 1: OAuth Token Endpoint
```typescript
class TokenManager {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async refreshToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.token = data.access_token;
    
    // Update stored token
    localStorage.setItem('token', this.token);
    
    return this.token;
  }

  async getValidToken(): Promise<string> {
    try {
      // Check if token is about to expire (within 1 hour)
      const decoded = jwt.decode(this.token) as JWTPayload;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;
      
      if (expiresIn < 3600) { // Less than 1 hour
        return await this.refreshToken();
      }
      
      return this.token;
    } catch (error) {
      // Token is invalid, try to refresh
      return await this.refreshToken();
    }
  }
}
```

### Method 2: Automatic Refresh Interceptor
```typescript
class APIClient {
  private baseUrl: string;
  private tokenManager: TokenManager;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.tokenManager = new TokenManager(baseUrl, token);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.tokenManager.getValidToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, try to refresh and retry once
      try {
        const newToken = await this.tokenManager.refreshToken();
        const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${newToken}`,
            ...options.headers,
          },
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Request failed: ${retryResponse.status}`);
        }
        
        return retryResponse.json();
      } catch (error) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw error;
      }
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  // API methods
  async uploadFile(file: File): Promise<File> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request<File>('/files/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async listFiles(options: any = {}): Promise<FileListResponse> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.request<FileListResponse>(`/files/list?${params}`);
  }
}
```

## 🛡️ Security Best Practices

### 1. Token Storage
```typescript
// ✅ Secure storage (recommended for production)
// Use httpOnly cookies instead of localStorage

// ⚠️ Current implementation (for development)
localStorage.setItem('token', token);

// ❌ Never do this
sessionStorage.setItem('token', token); // Lost on tab close
```

### 2. Token Validation
```typescript
const validateToken = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is expired
    if (decoded.exp < now) {
      return false;
    }
    
    // Check if token is not yet valid (clock skew)
    if (decoded.iat > now + 300) { // 5 minutes tolerance
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};
```

### 3. Automatic Logout
```typescript
const setupTokenMonitoring = () => {
  // Check token every minute
  setInterval(() => {
    const token = localStorage.getItem('token');
    if (token && !validateToken(token)) {
      // Token is invalid, logout user
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  }, 60000);
};
```

## 🔍 Token Debugging

### Decode Token (Client-side)
```typescript
const decodeToken = (token: string) => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    console.log('Token payload:', decoded);
    console.log('Expires at:', new Date(decoded.exp * 1000));
    console.log('Issued at:', new Date(decoded.iat * 1000));
    return decoded;
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
};
```

### Check Token Status
```typescript
const getTokenStatus = (token: string) => {
  const decoded = decodeToken(token);
  if (!decoded) {
    return { valid: false, reason: 'Invalid token format' };
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = decoded.exp - now;
  
  if (expiresIn < 0) {
    return { valid: false, reason: 'Token expired' };
  }
  
  if (expiresIn < 3600) {
    return { valid: true, reason: 'Token expires soon', expiresIn };
  }
  
  return { valid: true, reason: 'Token valid', expiresIn };
};
```

## 🚨 Error Handling

### Token Expiration Handling
```typescript
const handleTokenError = async (error: any, retryFunction: () => Promise<any>) => {
  if (error.statusCode === 401) {
    try {
      // Try to refresh token
      const newToken = await tokenManager.refreshToken();
      
      // Retry the original request
      return await retryFunction();
    } catch (refreshError) {
      // Refresh failed, redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
  }
  
  throw error;
};
```

### Network Error Handling
```typescript
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  
  throw new Error('Max retries exceeded');
};
```

## 📱 Integration Examples

### React Hook
```typescript
import { useState, useEffect } from 'react';

export const useToken = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isValid, setIsValid] = useState<boolean>(false);

  useEffect(() => {
    if (token) {
      const status = getTokenStatus(token);
      setIsValid(status.valid);
      
      if (!status.valid) {
        setToken(null);
        localStorage.removeItem('token');
      }
    }
  }, [token]);

  const refreshToken = async () => {
    if (!token) return;
    
    try {
      const tokenManager = new TokenManager('/api', token);
      const newToken = await tokenManager.refreshToken();
      setToken(newToken);
    } catch (error) {
      setToken(null);
      localStorage.removeItem('token');
    }
  };

  return { token, isValid, refreshToken };
};
```

### Vue Composable
```typescript
import { ref, onMounted } from 'vue';

export const useToken = () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const isValid = ref<boolean>(false);

  const validateToken = () => {
    if (!token.value) {
      isValid.value = false;
      return;
    }
    
    const status = getTokenStatus(token.value);
    isValid.value = status.valid;
    
    if (!status.valid) {
      token.value = null;
      localStorage.removeItem('token');
    }
  };

  const refreshToken = async () => {
    if (!token.value) return;
    
    try {
      const tokenManager = new TokenManager('/api', token.value);
      const newToken = await tokenManager.refreshToken();
      token.value = newToken;
    } catch (error) {
      token.value = null;
      localStorage.removeItem('token');
    }
  };

  onMounted(() => {
    validateToken();
  });

  return { token, isValid, refreshToken, validateToken };
};
```

This token management guide ensures secure, reliable authentication for your BetterSEQTA+ API integration. 