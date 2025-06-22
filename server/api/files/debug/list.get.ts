import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export default defineEventHandler(async (event: H3Event) => {
  const auth = getHeader(event, 'authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Missing or invalid token.' }));
  }
  
  let decoded;
  try {
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { id: number };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const userDataDir = path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files');
  
  const result: any = {
    userId: decoded.id,
    directories: {}
  };
  
  try {
    // Check public uploads directory
    if (fs.existsSync(uploadsDir)) {
      const publicFiles = fs.readdirSync(uploadsDir);
      result.directories.public = {
        path: uploadsDir,
        totalFiles: publicFiles.length,
        files: publicFiles.map(filename => {
          const filePath = path.join(uploadsDir, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
      };
    } else {
      result.directories.public = {
        error: 'Public uploads directory does not exist',
        path: uploadsDir
      };
    }

    // Check user's private data directory
    if (fs.existsSync(userDataDir)) {
      const privateFiles = fs.readdirSync(userDataDir);
      result.directories.private = {
        path: userDataDir,
        totalFiles: privateFiles.length,
        files: privateFiles.map(filename => {
          const filePath = path.join(userDataDir, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
      };
    } else {
      result.directories.private = {
        error: 'User data directory does not exist',
        path: userDataDir
      };
    }

    return result;
  } catch (error: any) {
    return {
      error: 'Failed to read directories',
      message: error?.message || 'Unknown error',
      userId: decoded.id,
      uploadsDir,
      userDataDir
    };
  }
}); 