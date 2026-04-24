import { SignJWT, jwtVerify } from "jose";
import type { Env } from "../types/env";
import { ACCESS_TOKEN_TTL, corsHeaders } from "../constants";

export type JwtUserPayload = {
  id: string;
  email?: string;
  username?: string;
  adminLevel?: number;
};

export async function getUser(req: Request, jwtSecret: Uint8Array): Promise<JwtUserPayload | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    return payload as JwtUserPayload;
  } catch {
    return null;
  }
}

export async function createAccessToken(
  user: { id: string; email?: string | null; username?: string | null },
  jwtSecret: Uint8Array,
): Promise<string> {
  return await new SignJWT({
    id: user.id,
    email: user.email,
    username: user.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(jwtSecret);
}

export async function getUserAdminLevel(env: Env, userId: string): Promise<number> {
  const user = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(userId).first();
  return user ? ((user.admin_level as number) || 0) : 0;
}

export async function getAdminUser(
  env: Env,
  req: Request,
  jwtSecret: Uint8Array,
): Promise<JwtUserPayload | null> {
  const payload = await getUser(req, jwtSecret);
  if (!payload) return null;
  const user = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(payload.id).first();
  if (user && ((user.admin_level as number) || 0) > 0) return payload;
  return null;
}

export async function getAdminUserWithLevel(
  env: Env,
  req: Request,
  jwtSecret: Uint8Array,
): Promise<(JwtUserPayload & { adminLevel: number }) | null> {
  const payload = await getUser(req, jwtSecret);
  if (!payload) return null;
  const user = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(payload.id).first();
  if (user && ((user.admin_level as number) || 0) > 0) {
    return { ...payload, adminLevel: (user.admin_level as number) || 0 };
  }
  return null;
}

export async function getMaxAdminLevel(env: Env): Promise<number> {
  const result = await env.DB.prepare("SELECT MAX(admin_level) as max_level FROM users WHERE admin_level > 0").first();
  const maxLevel = (result?.max_level as number) || 3;
  return Math.max(maxLevel, 3);
}

export async function verifyApiKey(env: Env, req: Request): Promise<{ id: string } | null> {
  const bearer = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("X-API-Key");
  const token = bearer && bearer.startsWith("Bearer ") ? bearer.slice(7) : (apiKeyHeader || "").trim();
  if (!token) return null;
  const row = await env.DB.prepare("SELECT id FROM api_keys WHERE token = ?").bind(token).first();
  return row ? { id: row.id as string } : null;
}

export function apiKeyUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "Invalid or missing API key" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function apiKeyDbError(e: unknown): Response {
  const msg = e instanceof Error ? e.message : String(e);
  const isTableMissing = /no such table|table.*does not exist/i.test(msg);
  const isColumnMissing = /no such column/i.test(msg);
  let errMsg = "Database error";
  if (isTableMissing) errMsg = "API keys table not found. Run migration: pnpm db:migrate:remote";
  else if (isColumnMissing) errMsg = "Database schema outdated. Run migration: pnpm db:migrate:remote";
  return new Response(JSON.stringify({ error: errMsg, detail: msg }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function authJson(data: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function authError(message: string, status = 401, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}
