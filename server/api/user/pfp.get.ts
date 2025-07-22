import { PrismaClient } from '@prisma/client';
import { getQuery, sendError } from 'h3';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const { id } = getQuery(event);
  if (!id) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Missing user ID.' }));
  }
  const user = await prisma.user.findUnique({ where: { id: id as string } });
  if (!user) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'User not found.' }));
  }
  return {
    pfpUrl: user.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.id}`
  };
}); 