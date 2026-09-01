import type { Env } from "../types/env";
import { FOUNDING_2500_THRESHOLD } from "./badges";

export type SignupOrderStats = {
  totalUsers: number;
  withSignupNumber: number;
  missingSignupNumber: number;
  founding2500Count: number;
  maxSignupNumber: number | null;
};

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

/** Read-only stats for admin signup-order tooling. */
export async function getSignupOrderStats(db: Env["DB"]): Promise<SignupOrderStats> {
  const totalRow = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  const withRow = await db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE signup_number IS NOT NULL")
    .first<{ count: number }>();
  const foundingRow = await db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE signup_number IS NOT NULL AND signup_number <= ?")
    .bind(FOUNDING_2500_THRESHOLD)
    .first<{ count: number }>();
  const maxRow = await db.prepare("SELECT MAX(signup_number) AS max_num FROM users").first<{ max_num: number | null }>();

  const totalUsers = totalRow?.count ?? 0;
  const withSignupNumber = withRow?.count ?? 0;

  return {
    totalUsers,
    withSignupNumber,
    missingSignupNumber: totalUsers - withSignupNumber,
    founding2500Count: foundingRow?.count ?? 0,
    maxSignupNumber: maxRow?.max_num ?? null,
  };
}

/** Full recompute: assign signup_number to every user by created_at ASC, id ASC. */
export async function recomputeAllSignupNumbers(db: Env["DB"]): Promise<number> {
  try {
    await db
      .prepare(
        `UPDATE users SET signup_number = (
          SELECT row_num FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS row_num
            FROM users
          ) AS ranked WHERE ranked.id = users.id
        )`,
      )
      .run();
    const totalRow = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    return totalRow?.count ?? 0;
  } catch {
    let rows: { id: string }[];
    try {
      const result = await db.prepare(SIGNUP_ORDER_SQL).all();
      rows = (result.results ?? []) as { id: string }[];
    } catch {
      const result = await db.prepare(SIGNUP_ORDER_FALLBACK_SQL).all();
      rows = (result.results ?? []) as { id: string }[];
    }

    for (let i = 0; i < rows.length; i++) {
      await db.prepare("UPDATE users SET signup_number = ? WHERE id = ?").bind(i + 1, rows[i].id).run();
    }
    return rows.length;
  }
}
