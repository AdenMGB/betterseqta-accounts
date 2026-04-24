import bcrypt from "bcryptjs";
import type { Env } from "../types/env";
import { APP_REFRESH_EXPIRY_DAYS, WEBSITE_REFRESH_EXPIRY_DAYS } from "../constants";
import { getRequestIp } from "./cookies";

export async function createSession(
  env: Env,
  params: {
    userId: string;
    platform: string;
    clientId?: string | null;
    deviceName?: string | null;
    request: Request;
    refreshDays?: number;
  },
): Promise<{ sessionId: string; refreshToken: string; expiresAt: number }> {
  const { userId, platform, clientId = null, deviceName = null, request, refreshDays = WEBSITE_REFRESH_EXPIRY_DAYS } =
    params;
  const sessionId = crypto.randomUUID();
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const secretB64 = btoa(String.fromCharCode(...secret));
  const refreshTokenHash = await bcrypt.hash(secretB64, 10);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + refreshDays * 24 * 60 * 60;
  const userAgent = request.headers.get("User-Agent");
  const ipAddress = getRequestIp(request);

  await env.DB.prepare(
    `INSERT INTO user_sessions (
                id, user_id, platform, client_id, refresh_token_hash, device_name,
                user_agent, created_ip, last_ip, created_at, last_used_at, expires_at, revoked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  )
    .bind(
      sessionId,
      userId,
      platform,
      clientId,
      refreshTokenHash,
      deviceName,
      userAgent,
      ipAddress,
      ipAddress,
      now,
      now,
      expiresAt,
    )
    .run();

  return {
    sessionId,
    refreshToken: `${sessionId}:${secretB64}`,
    expiresAt,
  };
}

export type SessionRefreshOk = {
  session: Record<string, unknown>;
  sessionId: string;
  now: number;
};

export type SessionRefreshErr = {
  error: string;
  status: number;
  session?: undefined;
  sessionId?: undefined;
  now?: undefined;
};

export async function getSessionByRefreshToken(
  env: Env,
  refreshToken: string | undefined,
): Promise<SessionRefreshOk | SessionRefreshErr> {
  if (!refreshToken || typeof refreshToken !== "string") {
    return { error: "Missing refresh_token", status: 400 };
  }
  const colonIdx = refreshToken.indexOf(":");
  if (colonIdx < 1) {
    return { error: "Invalid refresh_token format", status: 400 };
  }
  const sessionId = refreshToken.substring(0, colonIdx);
  const secret = refreshToken.substring(colonIdx + 1);
  const session = await env.DB.prepare("SELECT * FROM user_sessions WHERE id = ?").bind(sessionId).first();
  if (!session) {
    return { error: "Invalid refresh_token", status: 401 };
  }
  if (session.revoked_at) {
    return { error: "Session revoked", status: 401 };
  }
  const now = Math.floor(Date.now() / 1000);
  if ((session.expires_at as number) < now) {
    return { error: "Refresh token expired", status: 401 };
  }
  const valid = await bcrypt.compare(secret, session.refresh_token_hash as string);
  if (!valid) {
    return { error: "Invalid refresh_token", status: 401 };
  }
  return { session: session as Record<string, unknown>, sessionId, now };
}

export async function touchUserSession(
  env: Env,
  sessionId: string,
  now: number,
  request: Request,
  opts: { expiresAt?: number | null; clientId?: string | null } = {},
): Promise<number> {
  const nextExpiresAt = opts.expiresAt ?? now + APP_REFRESH_EXPIRY_DAYS * 24 * 60 * 60;
  const ipAddress = getRequestIp(request);
  await env.DB.prepare(
    "UPDATE user_sessions SET last_used_at = ?, expires_at = ?, last_ip = ?, client_id = COALESCE(?, client_id) WHERE id = ?",
  )
    .bind(now, nextExpiresAt, ipAddress, opts.clientId ?? null, sessionId)
    .run();
  return nextExpiresAt;
}

export async function revokeSessionById(env: Env, sessionId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "UPDATE user_sessions SET revoked_at = ?, expires_at = MIN(expires_at, ?) WHERE id = ? AND revoked_at IS NULL",
  )
    .bind(now, now, sessionId)
    .run();
}
