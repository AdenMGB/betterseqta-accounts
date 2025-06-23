import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { defineEventHandler, getQuery, sendError, sendRedirect } from 'h3';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://accounts.betterseqta.org/api/oauth/discord/callback';

export default defineEventHandler(async (event) => {
  const { code } = getQuery(event);
  if (!code) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Missing code from Discord.' }));
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID!,
      client_secret: DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: DISCORD_REDIRECT_URI,
      scope: 'identify email'
    })
  });
  if (!tokenRes.ok) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Failed to get Discord token.' }));
  }
  const tokenData = await tokenRes.json() as { access_token: string };
  const accessToken = tokenData.access_token;

  // Fetch user info from Discord
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!userRes.ok) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Failed to fetch Discord user.' }));
  }
  const discordUser = await userRes.json() as {
    id: string;
    username: string;
    global_name?: string;
    email?: string;
    avatar?: string;
  };

  // Upsert user in DB
  const user = await prisma.user.upsert({
    where: { provider_providerId: { provider: 'discord', providerId: discordUser.id } } as any,
    update: {
      email: discordUser.email,
      displayName: discordUser.global_name ? discordUser.global_name : discordUser.username,
      pfpUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
    },
    create: {
      provider: 'discord',
      providerId: discordUser.id,
      email: discordUser.email,
      username: `discord_${discordUser.id}`,
      displayName: discordUser.global_name ? discordUser.global_name : discordUser.username,
      pfpUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
    }
  });

  // Issue JWT
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  // Option 1: Redirect to frontend with token in query (recommended for SPA)
  // Option 2: Return token as JSON (for API clients)
  // Here, we'll redirect to /auth/discord/callback?token=... (frontend should handle this)
  const frontendRedirect = `https://accounts.betterseqta.org/auth/discord/callback?token=${token}`;
  return sendRedirect(event, frontendRedirect, 302);
}); 