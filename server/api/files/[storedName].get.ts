import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const prisma = new PrismaClient();

export default defineEventHandler(async (event: H3Event) => {
  const auth = getHeader(event, 'authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Missing or invalid token.' }));
  }
  
  let decoded;
  try {
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { id: string };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  // Extract storedName from URL path
  const url = event.node.req.url;
  const pathSegments = url?.split('/').filter(Boolean);
  let storedName = event.context.params?.storedName;
  
  if (!storedName && pathSegments && pathSegments.length >= 3) {
    storedName = pathSegments[2];
  }

  if (!storedName) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Stored name required.' }));
  }

  // Find the file in database and verify ownership
  const file = await prisma.file.findFirst({
    where: {
      storedName: storedName,
      userId: decoded.id
    }
  });

  if (!file) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File not found.' }));
  }

  // Determine file path based on public status
  let filePath: string;
  
  if (file.isPublic) {
    // Public files are in public/uploads
    filePath = path.join(process.cwd(), 'public', 'uploads', file.storedName);
  } else {
    // Private files are in data/users/{userId}/files
    filePath = path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files', file.storedName);
  }

  if (!fs.existsSync(filePath)) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File not found on disk.' }));
  }

  // Set response headers
  event.node.res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  event.node.res.setHeader('Content-Type', file.mimeType);
  event.node.res.setHeader('Content-Length', file.size.toString());
  event.node.res.setHeader('X-File-Id', file.id.toString());
  event.node.res.setHeader('X-File-Size', file.size.toString());
  event.node.res.setHeader('X-File-Type', file.mimeType);
  
  // Return file stream
  return fs.createReadStream(filePath);
}); 