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

  console.log(`[DEBUG] Public download request for storedName: ${storedName}`);

  // Find the file in database and verify it's public
  const file = await prisma.file.findFirst({
    where: {
      storedName: storedName,
      isPublic: true
    }
  });

  if (!file) {
    console.log(`[DEBUG] Public file not found in database for storedName: ${storedName}`);
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Public file not found.' }));
  }

  console.log(`[DEBUG] Public file found in database:`, {
    id: file.id,
    filename: file.filename,
    storedName: file.storedName,
    path: file.path,
    size: file.size,
    userId: file.userId
  });

  // Public files are stored in public/uploads
  const filePath = path.join(process.cwd(), 'public', 'uploads', file.storedName);

  console.log(`[DEBUG] Looking for public file at: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.log(`[DEBUG] Public file not found on disk at: ${filePath}`);
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Public file not found on disk.' }));
  }

  console.log(`[DEBUG] Public file found on disk, serving from: ${filePath}`);

  event.node.res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  event.node.res.setHeader('Content-Type', file.mimeType);
  event.node.res.setHeader('Content-Length', file.size.toString());
  
  return fs.createReadStream(filePath);
}); 