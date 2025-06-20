import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const DATA_DIR = path.resolve('data');

export default defineEventHandler(async (event: H3Event) => {
  const auth = getHeader(event, 'authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Missing or invalid token.' }));
  }
  let decoded;
  try {
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { id: number };
  } catch (e) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid or expired token.' }));
  }

  const filename = event.context.params?.filename;
  if (!filename) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Filename required.' }));
  }

  const filePath = path.join(DATA_DIR, String(decoded.id), filename);
  if (!fs.existsSync(filePath)) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'File not found.' }));
  }

  event.node.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  event.node.res.setHeader('Content-Type', 'application/octet-stream');
  return fs.createReadStream(filePath);
}); 