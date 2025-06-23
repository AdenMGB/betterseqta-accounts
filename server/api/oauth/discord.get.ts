import { defineEventHandler, sendRedirect } from 'h3';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://accounts.betterseqta.org/api/oauth/discord/callback';
const DISCORD_SCOPE = 'identify email';

export default defineEventHandler(async (event) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID!,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: DISCORD_SCOPE,
    prompt: 'consent'
  });
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  return sendRedirect(event, discordAuthUrl, 302);
}); 