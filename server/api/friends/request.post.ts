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
    decoded = jwt.verify(token, JWT_SECRET) as { id: string }
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid token' }))
  }

  const body = await readBody(event)
  const { username } = body
  if (!username) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Username is required' }))
  }

  const requesterId = decoded.id
  const addressee = await prisma.user.findUnique({ where: { username } })

  if (!addressee) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'User not found' }))
  }

  if (requesterId === addressee.id) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'You cannot send a friend request to yourself' }))
  }

  const existingRequest = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: requesterId },
      ],
    },
  })

  if (existingRequest) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Friend request already sent or you are already friends' }))
  }

  const friendship = await prisma.friendship.create({
    data: {
      requesterId,
      addresseeId: addressee.id,
    },
  })

  return friendship
}) 