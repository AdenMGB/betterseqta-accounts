import type { Env } from "../types/env";

const SIGNUP_ORDER_SQL = `
  SELECT id FROM users
  ORDER BY created_at ASC, id ASC
`;

const SIGNUP_ORDER_FALLBACK_SQL = `
  SELECT id FROM users
  ORDER BY id ASC
`;

/** Assign the next signup_number to a newly registered user. */
export async function assignSignupNumber(db: Env["DB"], userId: string): Promise<number> {
  const maxRow = await db.prepare("SELECT MAX(signup_number) AS max_num FROM users").first();
  const next = ((maxRow?.max_num as number | null) ?? 0) + 1;
  await db.prepare("UPDATE users SET signup_number = ? WHERE id = ?").bind(next, userId).run();
  return next;
}

/** Idempotent backfill: assign signup_number to users missing one, ordered by created_at ASC, id ASC. */
export async function backfillSignupNumbers(db: Env["DB"]): Promise<number> {
  let rows: { id: string }[];
  try {
    const result = await db.prepare(SIGNUP_ORDER_SQL).all();
    rows = (result.results ?? []) as { id: string }[];
  } catch {
    const result = await db.prepare(SIGNUP_ORDER_FALLBACK_SQL).all();
    rows = (result.results ?? []) as { id: string }[];
  }

  let assigned = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const existing = await db
      .prepare("SELECT signup_number FROM users WHERE id = ?")
      .bind(row.id)
      .first();
    if (existing?.signup_number != null) continue;
    await db.prepare("UPDATE users SET signup_number = ? WHERE id = ?").bind(i + 1, row.id).run();
    assigned++;
  }
  return assigned;
}
