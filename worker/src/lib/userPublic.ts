/** Columns for API user objects (camelCase pfpHash). */
export const USER_PUBLIC_SELECT =
  "id, email, username, displayName, pfpUrl, pfp_hash AS pfpHash, admin_level";

export type PublicUserRow = {
  id: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  pfpHash?: string | null;
  admin_level?: number;
};

export function mapUserPublic(row: Record<string, unknown> | null): PublicUserRow | null {
  if (!row) return null;
  return {
    id: row.id as string,
    email: row.email as string | null | undefined,
    username: row.username as string | null | undefined,
    displayName: row.displayName as string | null | undefined,
    pfpUrl: row.pfpUrl as string | null | undefined,
    pfpHash: (row.pfpHash ?? row.pfp_hash ?? null) as string | null,
    admin_level: (row.admin_level as number) || 0,
  };
}

export function publicUserFromCredentials(row: Record<string, string>): PublicUserRow {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    pfpUrl: row.pfpUrl,
    pfpHash: row.pfp_hash ?? null,
    admin_level: Number(row.admin_level) || 0,
  };
}
