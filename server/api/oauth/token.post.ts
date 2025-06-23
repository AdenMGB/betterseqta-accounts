import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { H3Event, sendError } from 'h3';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export default defineEventHandler(async (event: H3Event) => {
  const authHeader = getHeader(event, 'authorization');
  const body = await readBody(event).catch(() => ({}));

  // Case 1: Authorize with an existing JWT (for logged-in users)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return sendError(event, createError({ statusCode: 401, statusMessage: 'User not found.' }));

      const newToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      return { access_token: newToken, token_type: 'Bearer', expires_in: 604800 };
    } catch (e) {
      return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
    }
  }

  // Case 2: Authorize with email and password
  const { email, password } = body;
  if (email && password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid credentials.' }));

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid credentials.' }));

    const newToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return { access_token: newToken, token_type: 'Bearer', expires_in: 604800 };
  }

  return sendError(event, createError({ statusCode: 400, statusMessage: 'Missing credentials or token.' }));
}); 