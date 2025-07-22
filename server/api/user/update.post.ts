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
    decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  const body = await readBody(event);
  const { displayName, username, pfpUrl } = body;
  
  const dataToUpdate: { displayName?: string; username?: string; pfpUrl?: string } = {};

  if (displayName) {
    dataToUpdate.displayName = displayName;
  }
  if (username) {
     // Check if username is taken by another user
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== decoded.id) {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Username already in use.' }));
    }
    dataToUpdate.username = username;
  }
  if (pfpUrl) {
    dataToUpdate.pfpUrl = pfpUrl;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'No fields to update provided.' }));
  }
  
  const user = await prisma.user.update({
    where: { id: decoded.id },
    data: dataToUpdate,
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