import { H3Event } from 'h3';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event: H3Event) => {
  console.log(`[TEST] Test endpoint called`);
  
  const testData: any = {
    message: 'Files API is working!',
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    dataDir: path.join(process.cwd(), 'data'),
    dataDirExists: fs.existsSync(path.join(process.cwd(), 'data')),
    usersDir: path.join(process.cwd(), 'data', 'users'),
    usersDirExists: fs.existsSync(path.join(process.cwd(), 'data', 'users')),
    user1Dir: path.join(process.cwd(), 'data', 'users', '1'),
    user1DirExists: fs.existsSync(path.join(process.cwd(), 'data', 'users', '1')),
    filesDir: path.join(process.cwd(), 'data', 'users', '1', 'files'),
    filesDirExists: fs.existsSync(path.join(process.cwd(), 'data', 'users', '1', 'files'))
  };

  // Try to list files in the directory
  try {
    if (testData.filesDirExists) {
      const files = fs.readdirSync(testData.filesDir);
      testData.files = files;
      testData.fileCount = files.length;
      
      // Check specific file
      const specificFile = path.join(testData.filesDir, '5320570fb6762d08.json');
      testData.specificFileExists = fs.existsSync(specificFile);
      if (testData.specificFileExists) {
        const stats = fs.statSync(specificFile);
        testData.specificFileStats = {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      }
    }
  } catch (error: any) {
    testData.error = error.message;
  }

  return testData;
}); 