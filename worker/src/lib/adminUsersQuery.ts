import type { Env } from "../types/env";
import { displayUserBadges, labelForBadgeKey, type UserBadge } from "./badges";

export type AdminUserRow = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  pfpUrl: string | null;
  admin_level: number;
  signup_number: number | null;
  created_at: number | null;
  badges: UserBadge[];
};

const SELECT_VARIANTS = [
  "id, email, username, displayName, pfpUrl, admin_level, signup_number, createdAt AS created_at",
  "id, email, username, displayName, pfpUrl, admin_level, signup_number, created_at",
  "id, email, username, displayName, pfpUrl, admin_level, createdAt AS created_at",
  "id, email, username, displayName, pfpUrl, admin_level, created_at",
] as const;

function orderColumnForSort(sortColumn: string, selectSql: string): string {
  if (sortColumn === "created_at") {
    return selectSql.includes("createdAt AS") ? "createdAt" : "created_at";
  }
  return sortColumn;
}

export async function queryAdminUsersPage(
  db: Env["DB"],
  input: {
    whereClause: string;
    params: unknown[];
    sortColumn: string;
    sortDir: "ASC" | "DESC";
    pageSize: number;
    offset: number;
  },
): Promise<{ id: string; email: string; username: string; displayName: string | null; pfpUrl: string | null; admin_level: number; signup_number?: number | null; created_at?: number | null }[]> {
  const allowed = new Set(["username", "email", "displayName", "admin_level", "created_at"]);
  const sortKey = allowed.has(input.sortColumn) ? input.sortColumn : "username";

  for (const select of SELECT_VARIANTS) {
    try {
      const orderCol = orderColumnForSort(sortKey, select);
      const result = await db
        .prepare(
          `SELECT ${select} FROM users WHERE ${input.whereClause} ORDER BY ${orderCol} ${input.sortDir} LIMIT ? OFFSET ?`,
        )
        .bind(...input.params, input.pageSize, input.offset)
        .all();
      return (result.results ?? []) as {
        id: string;
        email: string;
        username: string;
        displayName: string | null;
        pfpUrl: string | null;
        admin_level: number;
        signup_number?: number | null;
        created_at?: number | null;
      }[];
    } catch {
      // try next schema variant
    }
  }

  throw new Error("Failed to query users — unsupported users table schema");
}

async function loadBadgesForUsers(
  db: Env["DB"],
  userIds: string[],
): Promise<Map<string, UserBadge[]>> {
  const map = new Map<string, UserBadge[]>();
  if (userIds.length === 0) return map;

  try {
    const placeholders = userIds.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT user_id, badge_key, awarded_at FROM user_badges WHERE user_id IN (${placeholders}) ORDER BY awarded_at ASC`,
      )
      .bind(...userIds)
      .all();

    for (const row of (result.results ?? []) as {
      user_id: string;
      badge_key: string;
      awarded_at: number;
    }[]) {
      const list = map.get(row.user_id) ?? [];
      list.push({
        key: row.badge_key,
        label: labelForBadgeKey(row.badge_key),
        awarded_at: row.awarded_at,
      });
      map.set(row.user_id, list);
    }
  } catch {
    // user_badges table may not exist yet
  }

  return map;
}

export async function enrichAdminUserRows(
  db: Env["DB"],
  rows: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    pfpUrl: string | null;
    admin_level: number;
    signup_number?: number | null;
    created_at?: number | null;
  }[],
  options?: { includeBadges?: boolean },
): Promise<AdminUserRow[]> {
  const includeBadges = options?.includeBadges !== false;
  const badgeMap = includeBadges
    ? await loadBadgesForUsers(
        db,
        rows.map((r) => r.id),
      )
    : new Map<string, UserBadge[]>();

  return rows.map((row) => {
    const signupNumber = row.signup_number ?? null;
    const rawBadges = badgeMap.get(row.id) ?? [];
    const badges = includeBadges ? displayUserBadges(rawBadges, signupNumber) : [];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.displayName,
      pfpUrl: row.pfpUrl,
      admin_level: row.admin_level ?? 0,
      signup_number: signupNumber,
      created_at: row.created_at ?? null,
      badges,
    };
  });
}
