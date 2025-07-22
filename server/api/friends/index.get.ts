import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { H3Event, sendError, getHeader } from 'h3'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret'

// Define the type for the friendship with included requester and addressee
interface FriendUser {
  id: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

interface FriendshipWithUsers {
  requesterId: number;
  addresseeId: number;
  requester: FriendUser;
  addressee: FriendUser;
}

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

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: decoded.id },
        { addresseeId: decoded.id },
      ],
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true, pfpUrl: true } },
      addressee: { select: { id: true, username: true, displayName: true, pfpUrl: true } },
    },
  })

  // Format the output to return the friend's info, not the requester's
  const friends = friendships.map((f: FriendshipWithUsers) => {
    return f.requesterId === decoded.id ? f.addressee : f.requester
  })

  return friends
}) 