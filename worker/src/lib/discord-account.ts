import bcrypt from "bcryptjs";
import type { Env } from "../types/env";
import { cleanEnvVar } from "./env-util";
import { ensureUserDesqtaSettings } from "./settings-bootstrap";

export type DiscordUserProfile = {
  id: string;
  email?: string;
  username?: string;
  global_name?: string;
  avatar?: string;
  verified?: boolean;
};

export type ResolveDiscordUserResult =
  | { ok: true; user: Record<string, unknown> }
  | {
      ok: false;
      reason:
        | "email_account_exists"
        | "discord_linked_elsewhere"
        | "discord_email_not_verified";
    };

function discordAvatarUrl(discordUser: DiscordUserProfile): string | null {
  return discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
    : null;
}

function normalizeDiscordEmail(discordUser: DiscordUserProfile): string {
  if (discordUser.email) return discordUser.email.toLowerCase().trim();
  return `discord_${discordUser.id}@discord.local`;
}

function isPlaceholderDiscordEmail(email: string): boolean {
  return email.endsWith("@discord.local");
}

export async function exchangeDiscordOAuthCode(
  env: Env,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<{ accessToken: string } | { error: string }> {
  const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
  const discordClientSecret = cleanEnvVar(env.DISCORD_CLIENT_SECRET);
  if (!discordClientId || !discordClientSecret)
    return { error: "not_configured" };

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    console.error("Discord token exchange failed:", await tokenResponse.text());
    return { error: "token_exchange_failed" };
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) return { error: "token_exchange_failed" };
  return { accessToken: tokenData.access_token };
}

export async function fetchDiscordUser(
  accessToken: string,
): Promise<DiscordUserProfile | null> {
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return null;
  return (await userResponse.json()) as DiscordUserProfile;
}

export async function resolveUserFromDiscord(
  env: Env,
  discordUser: DiscordUserProfile,
): Promise<ResolveDiscordUserResult> {
  const discordId = discordUser.id;
  const normalizedEmail = normalizeDiscordEmail(discordUser);
  const placeholder = isPlaceholderDiscordEmail(normalizedEmail);
  const now = Math.floor(Date.now() / 1000);
  const pfpUrl = discordAvatarUrl(discordUser);
  const displayName =
    discordUser.global_name ||
    discordUser.username ||
    `discord_${discordUser.id}`;

  const byDiscord = (await env.DB.prepare(
    "SELECT * FROM users WHERE discord_id = ?",
  )
    .bind(discordId)
    .first()) as Record<string, unknown> | null;
  if (byDiscord) {
    await env.DB.prepare(
      "UPDATE users SET displayName = ?, pfpUrl = ? WHERE id = ?",
    )
      .bind(displayName, pfpUrl, byDiscord.id)
      .run();
    const refreshed = (await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(byDiscord.id)
      .first()) as Record<string, unknown>;
    return { ok: true, user: refreshed };
  }

  const byEmail = placeholder
    ? null
    : ((await env.DB.prepare("SELECT * FROM users WHERE email = ?")
        .bind(normalizedEmail)
        .first()) as Record<string, unknown> | null);

  if (byEmail) {
    const existingDiscordId =
      typeof byEmail.discord_id === "string" ? byEmail.discord_id : null;
    if (existingDiscordId && existingDiscordId !== discordId) {
      return { ok: false, reason: "discord_linked_elsewhere" };
    }
    return { ok: false, reason: "email_account_exists" };
  }

  if (discordUser.verified == false) {
    return { ok: false, reason: "discord_email_not_verified" };
  }

  const userId = crypto.randomUUID();
  const username = discordUser.username || `discord_${discordUser.id}`;
  const randomPassword = crypto.randomUUID();
  const hashedPassword = await bcrypt.hash(randomPassword, 10);
  const emailVerifiedAt = placeholder ? null : now;

  await env.DB.prepare(
    "INSERT INTO users (id, email, password, username, displayName, pfpUrl, admin_level, discord_id, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      userId,
      normalizedEmail,
      hashedPassword,
      username,
      displayName,
      pfpUrl,
      0,
      discordId,
      emailVerifiedAt,
    )
    .run();
  await ensureUserDesqtaSettings(env.DB, userId);

  const user = (await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first()) as Record<string, unknown>;
  return { ok: true, user };
}
