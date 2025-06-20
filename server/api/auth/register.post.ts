import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { H3Event, sendError } from 'h3';

const prisma = new PrismaClient();

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody(event);
  const { email, password, username, displayName } = body;

  if (!email || !password || !username || !displayName) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'All fields are required.' }));
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Email already in use.' }));
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Username already in use.' }));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, username, displayName },
  });

  // Generate a profile picture URL using DiceBear Avatars API
  const pfpUrl = `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.id}`;
  await prisma.user.update({ where: { id: user.id }, data: { pfpUrl } });

  return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl, createdAt: user.createdAt };
}); 