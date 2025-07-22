import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { H3Event, sendError, getHeader, readBody } from 'h3'

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

  const { receiverId, groupId, content, replyToId, attachmentId } = await readBody(event)
  if (!content || (!receiverId && !groupId)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Receiver ID or Group ID and content are required' }))
  }

  let messageData: any = {
    senderId: decoded.id,
    content,
    replyToId,
    attachmentId,
  }

  if (groupId) {
    // Validate group membership
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId: decoded.id },
    })
    if (!member) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'You are not a member of this group' }))
    }
    messageData.groupId = groupId
  } else if (receiverId) {
    // Verify that the users are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: decoded.id, addresseeId: receiverId },
          { requesterId: receiverId, addresseeId: decoded.id },
        ],
      },
    })
    if (!friendship) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'You can only message friends' }))
    }
    messageData.receiverId = receiverId
  }

  const message = await prisma.message.create({
    data: messageData,
  })

  return message
}) 