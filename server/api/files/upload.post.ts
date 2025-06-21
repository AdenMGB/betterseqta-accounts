import { H3Event, sendError } from 'h3';
import jwt from 'jsonwebtoken';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
// Ensure the path is relative to the project root
const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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

  const form = formidable({ 
    multiples: false,
    uploadDir: UPLOAD_DIR,
    keepExtensions: true,
    // Generate a unique filename to prevent overwrites and improve security
    filename: (name, ext, part, form) => {
        const uniqueSuffix = randomBytes(8).toString('hex');
        const fileExtension = path.extname(part.originalFilename || '');
        return `${uniqueSuffix}${fileExtension}`;
    }
  });

  const files = await new Promise<formidable.Files>((resolve, reject) => {
    form.parse(event.node.req, (err, fields, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });

  const file = files.file;
  if (!file || !Array.isArray(file) || file.length === 0) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'No file uploaded.' }));
  }

  const uploadedFile = file[0];
  const newFileName = uploadedFile.newFilename;

  // The file is already saved to the correct directory by formidable
  // We just need to return the public URL
  return { url: `/uploads/${newFileName}` };
}); 