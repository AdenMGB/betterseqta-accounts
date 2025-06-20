export default defineEventHandler(async (event) => {
  // Log the logout event with IP and timestamp
  const ip = event.node.req.headers['x-forwarded-for'] || event.node.req.socket.remoteAddress;
  const timestamp = new Date().toISOString();
  console.log(`[LOGOUT] User logout from IP: ${ip} at ${timestamp}`);

  // If using httpOnly cookies, you would clear the cookie here.
  // For localStorage JWT, just return a success message.
  return { success: true, message: 'Logged out successfully. Please remove the token on the client.' }
}) 