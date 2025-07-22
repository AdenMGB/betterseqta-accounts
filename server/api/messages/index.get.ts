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

  // Find all groups the user is a member of
  const groupMembers = await prisma.groupMember.findMany({
    where: { userId: decoded.id },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: { select: { id: true, displayName: true } }
            }
          }
        }
      }
    }
  })

  // Format groups for frontend
  const groups = groupMembers.map(gm => ({
    id: gm.group.id,
    name: gm.group.name,
    iconUrl: gm.group.iconUrl,
    members: gm.group.members.map(m => ({ id: m.user.id, displayName: m.user.displayName }))
  }))

  return groups
}) 