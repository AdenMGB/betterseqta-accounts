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

  const chatId = event.context.params?.chatId;
  const { content, replyToId, attachmentId } = await readBody(event);
  if (!content && !attachmentId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Content or attachment required' }));
  }

  // Try to find group by this id
  const group = await prisma.group.findUnique({ where: { id: chatId } });
  let messageData: any = {
    senderId: decoded.id,
    content,
    replyToId,
    attachmentId,
  };
  if (group) {
    // Check membership
    const member = await prisma.groupMember.findFirst({ where: { groupId: chatId, userId: decoded.id } });
    if (!member) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'You are not a member of this group' }));
    }
    messageData.groupId = chatId;
  } else {
    // Fallback to DM
    const otherUserId = chatId;
    // Verify that the users are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: decoded.id, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: decoded.id },
        ],
      },
    });
    if (!friendship) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'You can only message friends' }));
    }
    messageData.receiverId = otherUserId;
  }

  const message = await prisma.message.create({
    data: messageData,
    include: {
      sender: { select: { id: true, username: true } },
      receiver: { select: { id: true, username: true } },
      group: { select: { id: true, name: true, iconUrl: true } },
      replyTo: true,
      attachment: true,
    },
  });

  return message;
}); 