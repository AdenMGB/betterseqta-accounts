import { H3Event } from 'h3';

export default defineEventHandler(async (event: H3Event) => {
  const id = event.context.params?.id;
  
  return {
    message: 'Dynamic route test',
    id: id,
    timestamp: new Date().toISOString(),
    url: event.node.req.url,
    method: event.node.req.method
  };
}); 