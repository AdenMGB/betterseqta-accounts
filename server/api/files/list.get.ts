import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const prisma = new PrismaClient();

export default defineEventHandler(async (event: H3Event) => {
  const auth = getHeader(event, 'authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Missing or invalid token.' }));
  }
  
  let decoded;
  try {
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { id: string };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  const query = getQuery(event);
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 20;
  const search = query.search as string;
  const mimeType = query.mimeType as string;
  const isPublic = query.isPublic as string;

  const skip = (page - 1) * limit;

  const where: any = {
    userId: decoded.id
  };

  if (search) {
    where.filename = {
      contains: search
    };
  }

  if (mimeType) {
    where.mimeType = mimeType;
  }

  if (isPublic !== undefined) {
    where.isPublic = isPublic === 'true';
  }

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        filename: true,
        storedName: true,
        mimeType: true,
        size: true,
        path: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.file.count({ where })
  ]);

  return {
    files,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}); 