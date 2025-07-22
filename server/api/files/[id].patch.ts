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

  const fileId = event.context.params?.id as string;
  if (!fileId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Invalid file ID.' }));
  }

  const body = await readBody(event);
  const { filename, isPublic } = body;

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      userId: decoded.id
    }
  });

  if (!file) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File not found.' }));
  }

  if (isPublic !== undefined && isPublic !== file.isPublic) {
    const oldPath = file.isPublic 
      ? path.join(process.cwd(), 'public', 'uploads', file.storedName)
      : path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files', file.storedName);
    
    const newPath = isPublic
      ? path.join(process.cwd(), 'public', 'uploads', file.storedName)
      : path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files', file.storedName);

    if (isPublic) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
    } else {
      const userDataDir = path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
    }

    if (fs.existsSync(oldPath)) {
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);
    }
  }

  const updateData: any = {};
  if (filename !== undefined) updateData.filename = filename;
  if (isPublic !== undefined) {
    updateData.isPublic = isPublic;
    updateData.path = isPublic 
      ? `/uploads/${file.storedName}`
      : `/data/users/${decoded.id}/files/${file.storedName}`;
  }

  const updatedFile = await prisma.file.update({
    where: { id: fileId },
    data: updateData,
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

  return updatedFile;
}); 