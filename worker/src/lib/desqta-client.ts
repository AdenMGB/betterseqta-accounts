import type { Env } from "../types/env";
import { DESQTA_CLIENT_TTL_DAYS } from "../constants";
import { isPersistentReservedRedirectUri } from "./redirect-uri";

export function isReservedClientExpired(
  redirectUri: string,
  expiresAt: number | null,
  appUrl?: string,
): boolean {
  if (isPersistentReservedRedirectUri(redirectUri, appUrl)) return false;
  if (expiresAt == null) return false;
  return expiresAt < Math.floor(Date.now() / 1000);
}

export function expiresAtForReservedClient(redirectUri: string, appUrl?: string): number | null {
  if (isPersistentReservedRedirectUri(redirectUri, appUrl)) return null;
  const now = Math.floor(Date.now() / 1000);
  return now + DESQTA_CLIENT_TTL_DAYS * 24 * 60 * 60;
}

export async function getDesqtaClient(
  env: Env,
  clientId: string,
  _redirectUri?: string,
): Promise<
  | { valid: true; redirect_uri: string; isReserved: boolean }
  | { valid: false; redirect_uri?: undefined; isReserved?: undefined }
> {
  const oauth = await env.DB.prepare("SELECT id, redirect_uri FROM oauth_clients WHERE id = ?").bind(clientId).first();
  if (oauth) return { valid: true, redirect_uri: oauth.redirect_uri as string, isReserved: false };
  const reserved = await env.DB.prepare("SELECT id, redirect_uri, expires_at FROM desqta_reserved_clients WHERE id = ?")
    .bind(clientId)
    .first();
  if (reserved) {
    const redirectUri = reserved.redirect_uri as string;
    if (isReservedClientExpired(redirectUri, reserved.expires_at as number | null, env.APP_URL)) {
      return { valid: false };
    }
    return { valid: true, redirect_uri: redirectUri, isReserved: true };
  }
  return { valid: false };
}

export async function validateDesqtaClient(env: Env, clientId: string, redirectUri: string): Promise<boolean> {
  const client = await getDesqtaClient(env, clientId, redirectUri);
  if (!client.valid) return false;
  return redirectUri ? client.redirect_uri === redirectUri : true;
}

export async function touchDesqtaReservedClient(env: Env, clientId: string): Promise<void> {
  const reserved = await env.DB.prepare("SELECT redirect_uri FROM desqta_reserved_clients WHERE id = ?")
    .bind(clientId)
    .first();
  if (!reserved) return;

  const redirectUri = reserved.redirect_uri as string;
  const expiresAt = expiresAtForReservedClient(redirectUri, env.APP_URL);
  await env.DB.prepare("UPDATE desqta_reserved_clients SET expires_at = ? WHERE id = ?")
    .bind(expiresAt, clientId)
    .run();
}
