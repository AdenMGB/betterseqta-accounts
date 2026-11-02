import type { Env } from "../types/env";
import { queryAdminUsersPage } from "./adminUsersQuery";
import { installRowToApi, type BsplusInstallRow } from "./bsplus-installs";

export function buildInteropUserSearchWhere(query: string): { whereClause: string; params: unknown[] } {
  const trimmed = query.trim();
  const like = `%${trimmed}%`;
  const searchFields = ["username LIKE ?", "email LIKE ?", "displayName LIKE ?", "id LIKE ?"];
  const searchParams: unknown[] = [like, like, like, like];
  if (/^\d+$/.test(trimmed)) {
    searchFields.push("signup_number = ?");
    searchParams.push(parseInt(trimmed, 10));
  }
  return {
    whereClause: `(${searchFields.join(" OR ")})`,
    params: searchParams,
  };
}

export async function searchInteropUsers(
  db: Env["DB"],
  input: { q: string; page: number; pageSize?: number },
): Promise<{
  users: Array<{
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    pfpUrl: string | null;
    signup_number: number | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 50);
  const page = Math.max(input.page, 1);
  const offset = (page - 1) * pageSize;
  const { whereClause, params } = buildInteropUserSearchWhere(input.q);

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`)
    .bind(...params)
    .first();
  const total = (countResult as { total: number } | null)?.total ?? 0;

  const rawUsers = await queryAdminUsersPage(db, {
    whereClause,
    params,
    sortColumn: "username",
    sortDir: "ASC",
    pageSize,
    offset,
  });

  const users = rawUsers.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    pfpUrl: u.pfpUrl,
    signup_number: u.signup_number ?? null,
  }));

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function searchInteropInstallLinks(
  db: Env["DB"],
  input: { q: string; page: number; pageSize?: number; cloudUserId?: string | null },
): Promise<{
  installs: Array<
    ReturnType<typeof installRowToApi> & {
      cloudUserId: string;
      username: string | null;
      email: string | null;
      displayName: string | null;
    }
  >;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 50);
  const page = Math.max(input.page, 1);
  const offset = (page - 1) * pageSize;
  const trimmed = input.q.trim();
  const like = `%${trimmed}%`;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.cloudUserId) {
    conditions.push("il.cloud_user_id = ?");
    params.push(input.cloudUserId.trim().toLowerCase());
  }

  if (trimmed) {
    conditions.push(
      `(il.install_id LIKE ? OR il.cloud_user_id LIKE ? OR il.device_name LIKE ?
        OR u.username LIKE ? OR u.email LIKE ? OR u.displayName LIKE ? OR u.id LIKE ?)`,
    );
    params.push(like, like, like, like, like, like, like);
  }

  const whereClause = conditions.length ? conditions.join(" AND ") : "1=1";

  const countResult = await db
    .prepare(
      `SELECT COUNT(*) as total
       FROM bsplus_install_link il
       LEFT JOIN users u ON u.id = il.cloud_user_id
       WHERE ${whereClause}`,
    )
    .bind(...params)
    .first();
  const total = (countResult as { total: number } | null)?.total ?? 0;

  const rows = await db
    .prepare(
      `SELECT il.install_id, il.cloud_user_id, il.device_name, il.extension_json,
              il.last_seen_at, il.linked_at, il.updated_at,
              u.username, u.email, u.displayName
       FROM bsplus_install_link il
       LEFT JOIN users u ON u.id = il.cloud_user_id
       WHERE ${whereClause}
       ORDER BY il.last_seen_at DESC, il.linked_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, pageSize, offset)
    .all();

  const installs = ((rows.results ?? []) as Array<
    BsplusInstallRow & {
      username: string | null;
      email: string | null;
      displayName: string | null;
    }
  >).map((row) => ({
    ...installRowToApi(row),
    cloudUserId: row.cloud_user_id,
    username: row.username,
    email: row.email,
    displayName: row.displayName,
  }));

  return {
    installs,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
