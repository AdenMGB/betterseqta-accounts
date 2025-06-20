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
  const { requestId } = body

  if (!requestId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Request ID is required' }))
  }

  const friendship = await prisma.friendship.findUnique({
    where: { id: requestId },
  })

  if (!friendship || (friendship.addresseeId !== decoded.id && friendship.requesterId !== decoded.id)) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Friend request not found or you are not part of this request' }))
  }

  await prisma.friendship.delete({
    where: { id: requestId },
  })

  return { success: true }
}) 