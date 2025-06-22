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
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { id: number };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  const fileId = parseInt(event.context.params?.id as string);
  if (!fileId || isNaN(fileId)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Invalid file ID.' }));
  }

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      userId: decoded.id
    }
  });

  if (!file) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File not found.' }));
  }

  let filePath: string;
  
  if (file.isPublic) {
    filePath = path.join(process.cwd(), 'public', 'uploads', file.storedName);
  } else {
    filePath = path.join(process.cwd(), 'data', 'users', String(decoded.id), 'files', file.storedName);
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.file.delete({
    where: { id: fileId }
  });

  return { message: 'File deleted successfully.' };
}); 