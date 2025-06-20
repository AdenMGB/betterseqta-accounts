import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const DATA_DIR = path.resolve('data');

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const form = formidable({ multiples: false });
  const [fields, files] = await new Promise<any[]>((resolve, reject) => {
    form.parse(event.node.req, (err, fields, files) => {
      if (err) reject(err);
      else resolve([fields, files]);
    });
  });

  const file = files.file;
  if (!file) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'No file uploaded.' }));
  }

  const userDir = path.join(DATA_DIR, String(decoded.id));
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  const filePath = path.join(userDir, file.originalFilename);
  fs.copyFileSync(file.filepath, filePath);

  return { success: true, path: `/api/files/${file.originalFilename}` };
}); 