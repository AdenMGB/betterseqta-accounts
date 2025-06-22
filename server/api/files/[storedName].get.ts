import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const prisma = new PrismaClient();

// Add this to verify the route is being called
console.log('[ROUTE] /api/files/[storedName].get.ts loaded');

export default defineEventHandler(async (event: H3Event) => {
  console.log(`[DEBUG] === DOWNLOAD REQUEST START ===`);
  console.log(`[DEBUG] Method: ${event.node.req.method}`);
  console.log(`[DEBUG] URL: ${event.node.req.url}`);
  console.log(`[DEBUG] Headers:`, getHeaders(event));

  // Debug: Check all possible ways to get the parameter
  console.log(`[DEBUG] 🔍 event.context.params:`, event.context.params);
  console.log(`[DEBUG] 🔍 event.context.params?.storedName:`, event.context.params?.storedName);
  
  // Try alternative ways to get the parameter
  const url = event.node.req.url;
  const pathSegments = url?.split('/').filter(Boolean);
  console.log(`[DEBUG] 🔍 URL path segments:`, pathSegments);
  
  // Extract storedName from URL path
  let storedName: string | undefined;
  
  // Method 1: Try context.params (Nuxt 3 standard)
  storedName = event.context.params?.storedName;
  
  // Method 2: If that fails, extract from URL path
  if (!storedName && pathSegments && pathSegments.length >= 3) {
    // URL format: /api/files/{storedName}
    // pathSegments: ['api', 'files', '{storedName}']
    storedName = pathSegments[2];
    console.log(`[DEBUG] 🔍 Extracted storedName from URL path: ${storedName}`);
  }
  
  // Method 3: Try getRouterParam (Nuxt 3 alternative)
  if (!storedName) {
    try {
      storedName = getRouterParam(event, 'storedName');
      console.log(`[DEBUG] 🔍 getRouterParam result: ${storedName}`);
    } catch (e) {
      console.log(`[DEBUG] 🔍 getRouterParam failed:`, e);
    }
  }

  console.log(`[DEBUG] 🔍 Final storedName: ${storedName}`);

  const auth = getHeader(event, 'authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    console.log(`[DEBUG] ❌ Missing or invalid authorization header`);
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Missing or invalid token.' }));
  }
  
  let decoded;
  try {
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { id: number };
    console.log(`[DEBUG] ✅ Token verified, userId: ${decoded.id}`);
  } catch (e) {
    console.log(`[DEBUG] ❌ Token verification failed:`, e);
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  if (!storedName) {
    console.log(`[DEBUG] ❌ No storedName found in any method`);
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Stored name required.' }));
  }

  console.log(`[DEBUG] 📁 Looking for file: ${storedName} for user: ${decoded.id}`);

  // Find the file in database and verify ownership
  const file = await prisma.file.findFirst({
    where: {
      storedName: storedName,
      userId: decoded.id
    }
  });

  if (!file) {
    console.log(`[DEBUG] ❌ File not found in database for storedName: ${storedName}, userId: ${decoded.id}`);
    
    // Let's check if the file exists for any user (for debugging)
    const anyFile = await prisma.file.findFirst({
      where: { storedName: storedName }
    });
    if (anyFile) {
      console.log(`[DEBUG] 🔍 File exists but belongs to user ${anyFile.userId}, not ${decoded.id}`);
    }
    
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File not found.' }));
  }

  console.log(`[DEBUG] ✅ File found in database:`, {
    id: file.id,
    filename: file.filename,
    storedName: file.storedName,
    path: file.path,
    size: file.size,
    isPublic: file.isPublic,
    userId: file.userId
  });

  // Determine file path based on public status
  let filePath: string;
  
  if (file.isPublic) {
    // Public files are in public/uploads
    filePath = path.join(process.cwd(), 'public', 'uploads', file.storedName);
    console.log(`[DEBUG] 📂 Public file path: ${filePath}`);
  } else {
    // Private files are in data/users/{userId}/files
    filePath = path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files', file.storedName);
    console.log(`[DEBUG] 📂 Private file path: ${filePath}`);
  }

  // Check if directory exists
  const dirPath = path.dirname(filePath);
  console.log(`[DEBUG] 📁 Checking directory: ${dirPath}`);
  console.log(`[DEBUG] 📁 Directory exists: ${fs.existsSync(dirPath)}`);

  if (!fs.existsSync(dirPath)) {
    console.log(`[DEBUG] ❌ Directory does not exist: ${dirPath}`);
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File directory not found.' }));
  }

  // List files in directory for debugging
  try {
    const filesInDir = fs.readdirSync(dirPath);
    console.log(`[DEBUG] 📋 Files in directory:`, filesInDir);
  } catch (e) {
    console.log(`[DEBUG] ❌ Error reading directory:`, e);
  }

  console.log(`[DEBUG] 🔍 Checking if file exists at: ${filePath}`);
  console.log(`[DEBUG] 🔍 File exists: ${fs.existsSync(filePath)}`);

  if (!fs.existsSync(filePath)) {
    console.log(`[DEBUG] ❌ File not found on disk at: ${filePath}`);
    
    // Try alternative paths for debugging
    const altPaths = [
      path.join(process.cwd(), 'public', 'uploads', file.storedName),
      path.join(process.cwd(), 'uploads', file.storedName),
      path.join(process.cwd(), 'data', 'files', file.storedName),
      path.join(process.cwd(), file.storedName)
    ];
    
    console.log(`[DEBUG] 🔍 Trying alternative paths:`);
    for (const altPath of altPaths) {
      console.log(`[DEBUG] 🔍 ${altPath}: ${fs.existsSync(altPath)}`);
    }
    
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File not found on disk.' }));
  }

  // Get file stats
  try {
    const stats = fs.statSync(filePath);
    console.log(`[DEBUG] 📊 File stats:`, {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    });
  } catch (e) {
    console.log(`[DEBUG] ❌ Error getting file stats:`, e);
  }

  console.log(`[DEBUG] ✅ File found on disk, serving from: ${filePath}`);

  // Set response headers
  event.node.res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  event.node.res.setHeader('Content-Type', file.mimeType);
  event.node.res.setHeader('Content-Length', file.size.toString());
  event.node.res.setHeader('X-File-Id', file.id.toString());
  event.node.res.setHeader('X-File-Size', file.size.toString());
  event.node.res.setHeader('X-File-Type', file.mimeType);
  
  console.log(`[DEBUG] 📤 Response headers set:`, {
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'Content-Type': file.mimeType,
    'Content-Length': file.size.toString(),
    'X-File-Id': file.id.toString()
  });

  console.log(`[DEBUG] === DOWNLOAD REQUEST END ===`);
  
  // Return file stream
  return fs.createReadStream(filePath);
}); 