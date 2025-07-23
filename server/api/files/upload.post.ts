import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const prisma = new PrismaClient();

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  // Check if upload should be public (for chat attachments and profile pictures)
  const query = getQuery(event);
  const isPublic = query.public === 'true';

  const form = formidable({ 
    multiples: false,
    keepExtensions: true,
    filename: (name, ext, part, form) => {
        const uniqueSuffix = randomBytes(8).toString('hex');
        const fileExtension = path.extname(part.originalFilename || '');
        return `${uniqueSuffix}${fileExtension}`;
    }
  });

  const files = await new Promise<formidable.Files>((resolve, reject) => {
    form.parse(event.node.req, (err, fields, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });

  const file = files.file;
  if (!file || !Array.isArray(file) || file.length === 0) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'No file uploaded.' }));
  }

  const uploadedFile = file[0];
  const newFileName = uploadedFile.newFilename;
  const originalFilename = uploadedFile.originalFilename || 'unknown';
  const fileSize = uploadedFile.size || 0;
  const mimeType = uploadedFile.mimetype || 'application/octet-stream';

  // 30MB limit
  const MAX_SIZE = 30 * 1024 * 1024;
  if (fileSize > MAX_SIZE) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'File size exceeds 30MB limit.' }));
  }

  const userDataDir = path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const tempFilePath = uploadedFile.filepath;
  let finalFilePath: string;
  let dbPath: string;
  
  if (isPublic) {
    // Public uploads (for chat attachments and profile pictures)
    const publicDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    finalFilePath = path.join(publicDir, newFileName);
    dbPath = `/uploads/${newFileName}`;
  } else {
    // Private uploads (default - for user files, configs, etc.)
    finalFilePath = path.join(userDataDir, newFileName);
    dbPath = `/data/users/${decoded.id}/files/${newFileName}`;
  }
  
  fs.copyFileSync(tempFilePath, finalFilePath);
  fs.unlinkSync(tempFilePath);

  const fileRecord = await prisma.file.create({
    data: {
      userId: decoded.id,
      filename: originalFilename,
      storedName: newFileName,
      mimeType: mimeType,
      size: fileSize,
      path: dbPath,
      isPublic: isPublic
    },
    select: {
      id: true,
      userId: true,
      filename: true,
      storedName: true,
      mimeType: true,
      size: true,
      path: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return fileRecord;
}); 