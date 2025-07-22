import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { H3Event, sendError, getHeader, readBody } from 'h3';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export default defineEventHandler(async (event: H3Event) => {
  const authHeader = getHeader(event, 'authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Unauthorized' }));
  }

  const token = authHeader.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id: string };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid token' }));
  }

  const { name, memberIds } = await readBody(event);
  if (!name || !Array.isArray(memberIds) || memberIds.length === 0) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Name and memberIds are required' }));
  }

  // Add creator to the group as owner
  const uniqueMemberIds = Array.from(new Set([decoded.id, ...memberIds]));

  const group = await prisma.group.create({
    data: {
      name,
      members: {
        create: uniqueMemberIds.map((userId) => ({
          userId,
          role: userId === decoded.id ? 'owner' : 'member',
        })),
      },
    },
    include: {
      members: { include: { user: { select: { id: true, displayName: true } } } },
    },
  });

  return {
    id: group.id,
    name: group.name,
    members: group.members.map(m => ({ id: m.user.id, displayName: m.user.displayName })),
  };
}); 