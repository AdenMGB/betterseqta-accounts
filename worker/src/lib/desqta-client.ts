import type { Env } from "../types/env";
import { DESQTA_CLIENT_TTL_DAYS } from "../constants";

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
    const now = Math.floor(Date.now() / 1000);
    const expAt = reserved.expires_at as number | null;
    if (expAt != null && expAt < now) {
      return { valid: false };
    }
    return { valid: true, redirect_uri: reserved.redirect_uri as string, isReserved: true };
  }
  return { valid: false };
}

export async function validateDesqtaClient(env: Env, clientId: string, redirectUri: string): Promise<boolean> {
  const client = await getDesqtaClient(env, clientId, redirectUri);
  if (!client.valid) return false;
  return redirectUri ? client.redirect_uri === redirectUri : true;
}

export async function touchDesqtaReservedClient(env: Env, clientId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + DESQTA_CLIENT_TTL_DAYS * 24 * 60 * 60;
  await env.DB.prepare("UPDATE desqta_reserved_clients SET expires_at = ? WHERE id = ?").bind(expiresAt, clientId).run();
}
