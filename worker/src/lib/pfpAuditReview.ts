import type { Env } from "../types/env";
import type { PfpAuditCandidate, PfpAuditPickMode } from "./pfpHistory";

export const PFP_AUDIT_APPROVALS_REQUIRED = 2;

export async function setPfpPendingReview(env: Env, userId: string, pending: boolean): Promise<void> {
  try {
    await env.DB.prepare("UPDATE users SET pfp_pending_review = ? WHERE id = ?")
      .bind(pending ? 1 : 0, userId)
      .run();
  } catch {
    // Pre-migration DB
  }
}

export async function recordPfpAuditAdminView(
  env: Env,
  adminUserId: string,
  subjectUserId: string,
  pfpHash: string,
): Promise<void> {
  if (!adminUserId || !subjectUserId || !pfpHash) return;
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO pfp_audit_admin_views (admin_user_id, subject_user_id, pfp_hash, created_at)
       VALUES (?, ?, ?, unixepoch())`,
    )
      .bind(adminUserId, subjectUserId, pfpHash)
      .run();
  } catch {
    // Tables may not exist pre-migration
  }
}

export async function recordPfpAuditAcceptance(
  env: Env,
  adminUserId: string,
  subjectUserId: string,
  pfpHash: string,
): Promise<{ distinctAcceptances: number; reviewComplete: boolean }> {
  await recordPfpAuditAdminView(env, adminUserId, subjectUserId, pfpHash);

  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO pfp_audit_acceptances (admin_user_id, subject_user_id, pfp_hash, created_at)
       VALUES (?, ?, ?, unixepoch())`,
    )
      .bind(adminUserId, subjectUserId, pfpHash)
      .run();

    const countRow = (await env.DB.prepare(
      `SELECT COUNT(DISTINCT admin_user_id) AS n FROM pfp_audit_acceptances
       WHERE subject_user_id = ? AND pfp_hash = ?`,
    )
      .bind(subjectUserId, pfpHash)
      .first()) as { n: number } | null;

    const distinctAcceptances = countRow?.n ?? 0;
    const reviewComplete = distinctAcceptances >= PFP_AUDIT_APPROVALS_REQUIRED;

    if (reviewComplete) {
      await setPfpPendingReview(env, subjectUserId, false);
    }

    return { distinctAcceptances, reviewComplete };
  } catch {
    return { distinctAcceptances: 0, reviewComplete: false };
  }
}

export async function pickPfpAuditCandidateForAdmin(
  env: Env,
  adminUserId: string,
  excludeUserIds: string[],
  options?: { mode?: PfpAuditPickMode; devRelaxed?: boolean },
): Promise<PfpAuditCandidate | null> {
  const mode = options?.mode ?? "random";
  const devRelaxed = options?.devRelaxed ?? false;
  const capped = excludeUserIds.slice(0, 200);

  const hostedPfp = devRelaxed
    ? "(u.pfp_hash IS NOT NULL OR (u.pfpUrl IS NOT NULL AND TRIM(u.pfpUrl) != ''))"
    : "u.pfp_hash IS NOT NULL";

  let query = `
    SELECT u.id, u.username, u.displayName, u.pfpUrl, u.pfp_hash
    FROM users u
    WHERE u.pfp_pending_review = 1
      AND ${hostedPfp}
      AND NOT EXISTS (
        SELECT 1 FROM pfp_audit_admin_views v
        WHERE v.admin_user_id = ?
          AND v.subject_user_id = u.id
          AND v.pfp_hash = u.pfp_hash
      )`;

  const binds: unknown[] = [adminUserId];

  if (capped.length > 0) {
    query += ` AND u.id NOT IN (${capped.map(() => "?").join(",")})`;
    binds.push(...capped);
  }

  query += mode === "sequential" ? " ORDER BY u.username ASC, u.id ASC LIMIT 1" : " ORDER BY RANDOM() LIMIT 1";

  try {
    const row = (await env.DB.prepare(query)
      .bind(...binds)
      .first()) as {
      id: string;
      username: string;
      displayName: string | null;
      pfpUrl: string;
      pfp_hash: string | null;
    } | null;

    if (!row?.pfp_hash) return null;

    const candidate: PfpAuditCandidate = {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      pfpUrl: row.pfpUrl,
      pfpHash: row.pfp_hash,
    };

    await recordPfpAuditAdminView(env, adminUserId, row.id, row.pfp_hash);
    return candidate;
  } catch {
    return null;
  }
}

export async function loadPfpReviewMetaForUsers(
  env: Env,
  userIds: string[],
): Promise<Map<string, { pfpPendingReview: boolean; pfpHash: string | null }>> {
  const map = new Map<string, { pfpPendingReview: boolean; pfpHash: string | null }>();
  if (userIds.length === 0) return map;

  try {
    const placeholders = userIds.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT id, pfp_hash, pfp_pending_review FROM users WHERE id IN (${placeholders})`,
    )
      .bind(...userIds)
      .all();

    for (const row of (rows.results || []) as {
      id: string;
      pfp_hash: string | null;
      pfp_pending_review: number;
    }[]) {
      map.set(row.id, {
        pfpPendingReview: row.pfp_pending_review === 1,
        pfpHash: row.pfp_hash,
      });
    }
  } catch {
    // Pre-migration
  }

  return map;
}
