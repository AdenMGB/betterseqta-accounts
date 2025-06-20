import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { H3Event, sendError } from 'h3';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export default defineEventHandler(async (event: H3Event) => {
  const auth = getHeader(event, 'authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Missing or invalid token.' }));
  }
  const token = auth.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  const body = await readBody(event);
  const { displayName, username } = body;
  if (!displayName || !username) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Display name and username are required.' }));
  }

  // Check if username is taken by another user
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== decoded.id) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Username already in use.' }));
  }

  const user = await prisma.user.update({
    where: { id: decoded.id },
    data: { displayName, username },
  });

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    pfpUrl: user.pfpUrl,
    createdAt: user.createdAt
  };
}); 