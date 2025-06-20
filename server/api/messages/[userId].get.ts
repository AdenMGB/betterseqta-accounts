import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { H3Event, sendError, getHeader } from 'h3'

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
    decoded = jwt.verify(token, JWT_SECRET) as { id: number }
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid token' }))
  }

  const otherUserId = Number(event.context.params?.userId)
  if (isNaN(otherUserId)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Invalid user ID' }))
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: decoded.id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: decoded.id },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
        sender: { select: { id: true, username: true, pfpUrl: true } },
        receiver: { select: { id: true, username: true, pfpUrl: true } },
    }
  })

  // Mark messages as read
  await prisma.message.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: decoded.id,
      read: false,
    },
    data: {
      read: true,
    },
  })

  return messages
}) 