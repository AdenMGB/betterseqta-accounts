import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { H3Event, sendError } from 'h3';

const prisma = new PrismaClient();

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody(event);
  const { email, password } = body;

  if (!email || !password) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Email and password are required.' }));
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Email already in use.' }));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  return { id: user.id, email: user.email, createdAt: user.createdAt };
}); 