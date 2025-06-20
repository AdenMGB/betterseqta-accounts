import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { H3Event, sendError } from 'h3';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody(event);
  const { email, password } = body;

  if (!email || !password) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Email and password are required.' }));
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid credentials.' }));
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid credentials.' }));
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  return { token };
}); 