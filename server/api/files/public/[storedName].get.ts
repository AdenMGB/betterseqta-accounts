import { H3Event, sendError } from 'h3';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export default defineEventHandler(async (event: H3Event) => {
  const storedName = event.context.params?.storedName;
  if (!storedName) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Stored name required.' }));
  }

  const file = await prisma.file.findFirst({
    where: {
      storedName: storedName,
      isPublic: true
    }
  });

  if (!file) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Public file not found.' }));
  }

  const filePath = path.join(process.cwd(), 'public', 'uploads', file.storedName);

  if (!fs.existsSync(filePath)) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Public file not found on disk.' }));
  }

  event.node.res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  event.node.res.setHeader('Content-Type', file.mimeType);
  event.node.res.setHeader('Content-Length', file.size.toString());
  
  return fs.createReadStream(filePath);
}); 