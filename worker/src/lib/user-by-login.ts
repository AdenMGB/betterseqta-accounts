import type { Env } from "../types/env";

/**
 * Look up a user for password login. Emails are stored lowercase (see migration 0005);
 * use a single indexed column per request instead of LOWER(email) OR username.
 */
export async function findUserByCredentialsLogin(
  db: Env["DB"],
  login: string,
): Promise<Record<string, string> | null> {
  if (login.includes("@")) {
    const email = login.toLowerCase().trim();
    return (await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first()) as Record<
      string,
      string
    > | null;
  }
  return (await db.prepare("SELECT * FROM users WHERE username = ?").bind(login).first()) as Record<
    string,
    string
  > | null;
}

/** Same lookup rules as login, but only fields needed for password reset flow. */
export async function findUserProfileByLogin(
  db: Env["DB"],
  login: string,
): Promise<{ id: string; email: string; displayName?: string } | null> {
  if (login.includes("@")) {
    const email = login.toLowerCase().trim();
    return (await db
      .prepare("SELECT id, email, displayName FROM users WHERE email = ?")
      .bind(email)
      .first()) as { id: string; email: string; displayName?: string } | null;
  }
  return (await db
    .prepare("SELECT id, email, displayName FROM users WHERE username = ?")
    .bind(login)
    .first()) as { id: string; email: string; displayName?: string } | null;
}
