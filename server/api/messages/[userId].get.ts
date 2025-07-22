import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { H3Event, sendError, getHeader, getQuery } from 'h3'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret'

export default defineEventHandler(async (event: H3Event) => {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Unauthorized' }))
  }

  const token = authHeader.slice(7)
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id: string }
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid token' }))
  }

  const chatId = event.context.params?.userId || event.context.params?.chatId;
  if (!chatId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Missing chat ID.' }));
  }
  const query = getQuery(event);
  const pageSize = 25;
  const pageParam = parseInt(query.page as string) || 1;
  const skip = (pageParam - 1) * pageSize;

  // Try to find group by this id
  const group = await prisma.group.findUnique({ where: { id: chatId } });
  let messages: any[] = [];
  if (group) {
    // Check membership
    const member = await prisma.groupMember.findFirst({ where: { groupId: chatId, userId: decoded.id } });
    if (!member) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'You are not a member of this group' }));
    }
    // Paginated fetch by page
    messages = await prisma.message.findMany({
      where: { groupId: chatId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        sender: { select: { id: true, username: true } },
        group: { select: { id: true, name: true, iconUrl: true } },
        replyTo: true,
        attachment: true,
      },
    });
  } else {
    // Fallback to DM
    const otherUserId = chatId;
    // Paginated fetch by page for DMs
    messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: decoded.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: decoded.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        sender: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } },
        replyTo: true,
        attachment: true,
      },
    });
    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: decoded.id,
        read: false,
      },
      data: { read: true },
    });
  }
  // Return messages in chronological order
  return messages.reverse();
}); 