import { H3Event } from 'h3';

export default defineEventHandler(async (event: H3Event) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.version,
    platform: process.platform,
    arch: process.arch
  };
}); 