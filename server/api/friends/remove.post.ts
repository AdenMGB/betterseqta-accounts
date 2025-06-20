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
  
  const body = await readBody(event)
  const { friendId } = body

  if (!friendId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Friend ID is required' }))
  }

  const userId = decoded.id

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
  })

  if (!friendship) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Friendship not found' }))
  }

  await prisma.friendship.delete({
    where: { id: friendship.id },
  })

  return { success: true }
}) 