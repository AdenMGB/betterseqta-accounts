import bcrypt from "bcryptjs";
import type { Env } from "../types/env";
import { sendEmailVerificationEmail } from "./email";

const VERIFY_TTL_SEC = 24 * 60 * 60;

export function isEmailVerificationDisabled(env?: Pick<Env, "DISABLE_EMAIL_VERIFICATION">): boolean {
  const v = (env?.DISABLE_EMAIL_VERIFICATION ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function userRequiresEmailVerification(
  user: { email?: string | null; email_verified_at?: number | null },
  env?: Pick<Env, "DISABLE_EMAIL_VERIFICATION">,
): boolean {
  if (env && isEmailVerificationDisabled(env)) return false;
  const email = (user.email || "").toLowerCase();
  if (!email || email.endsWith("@discord.local")) return false;
  const at = user.email_verified_at;
  return at == null || at === 0;
}

export async function issueEmailVerificationToken(env: Env, userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const hashedToken = await bcrypt.hash(token, 10);
  const expiresAt = Math.floor(Date.now() / 1000) + VERIFY_TTL_SEC;
  await env.DB.prepare("UPDATE email_verification_tokens SET used = 1 WHERE user_id = ? AND used = 0").bind(userId).run();
  await env.DB.prepare(
    "INSERT INTO email_verification_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)",
  )
    .bind(hashedToken, userId, expiresAt)
    .run();
  return token;
}

export async function sendUserEmailVerification(
  env: Env,
  userId: string,
  email: string,
  displayName: string | null,
): Promise<void> {
  const token = await issueEmailVerificationToken(env, userId);
  await sendEmailVerificationEmail(email, token, env, displayName);
}

export async function verifyEmailToken(
  env: Env,
  rawToken: string | null,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  if (!rawToken?.trim()) return { ok: false, reason: "missing_token" };

  const now = Math.floor(Date.now() / 1000);
  const rows = await env.DB.prepare(
    "SELECT token, user_id, expires_at, used FROM email_verification_tokens WHERE expires_at > ? AND used = 0",
  )
    .bind(now)
    .all();

  for (const dbToken of rows.results ?? []) {
    const row = dbToken as { token: string; user_id: string; expires_at: number; used: number };
    if (!(await bcrypt.compare(rawToken.trim(), row.token))) continue;
    await env.DB.prepare("UPDATE email_verification_tokens SET used = 1 WHERE token = ?").bind(row.token).run();
    await env.DB.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").bind(now, row.user_id).run();
    return { ok: true, userId: row.user_id };
  }
  return { ok: false, reason: "invalid_or_expired" };
}