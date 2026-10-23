import type { Env } from "../types/env";
import { processPfpUpload } from "./pfpProcess";
import type { PfpAuditCandidate, PfpAuditPickMode } from "./pfpHistory";
import { putCurrentPfp, saveCurrentPfpToHistory } from "./pfpHistory";

export const PFP_AUDIT_APPROVALS_REQUIRED = 2;

export type PfpAuditDecisionType = "accept" | "remove";

export type PfpAuditDecisionRow = {
  id: string;
  adminUserId: string;
  adminUsername: string | null;
  subjectUserId: string;
  subjectUsername: string;
  subjectDisplayName: string | null;
  pfpHash: string;
  pfpUrl: string;
  pfpHistoryId: string | null;
  decision: PfpAuditDecisionType;
  removeReason: string | null;
  createdAt: number;
  updatedAt: number;
};

export async function setPfpPendingReview(env: Env, userId: string, pending: boolean): Promise<void> {
  try {
    await env.DB.prepare("UPDATE users SET pfp_pending_review = ? WHERE id = ?")
      .bind(pending ? 1 : 0, userId)
      .run();
  } catch {
    // Pre-migration DB
  }
}

export async function recalculatePfpPendingReview(env: Env, subjectUserId: string): Promise<void> {
  try {
    const row = (await env.DB.prepare("SELECT pfp_hash FROM users WHERE id = ?")
      .bind(subjectUserId)
      .first()) as { pfp_hash: string | null } | null;
    if (!row?.pfp_hash) {
      await setPfpPendingReview(env, subjectUserId, false);
      return;
    }
    const countRow = (await env.DB.prepare(
      `SELECT COUNT(DISTINCT admin_user_id) AS n FROM pfp_audit_acceptances
       WHERE subject_user_id = ? AND pfp_hash = ?`,
    )
      .bind(subjectUserId, row.pfp_hash)
      .first()) as { n: number } | null;
    const n = countRow?.n ?? 0;
    await setPfpPendingReview(env, subjectUserId, n < PFP_AUDIT_APPROVALS_REQUIRED);
  } catch {
    // Pre-migration
  }
}

export async function removePfpAuditAcceptance(
  env: Env,
  adminUserId: string,
  subjectUserId: string,
  pfpHash: string,
): Promise<void> {
  try {
    await env.DB.prepare(
      `DELETE FROM pfp_audit_acceptances
       WHERE admin_user_id = ? AND subject_user_id = ? AND pfp_hash = ?`,
    )
      .bind(adminUserId, subjectUserId, pfpHash)
      .run();
  } catch {
    // Pre-migration
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

export async function upsertPfpAuditDecision(
  env: Env,
  input: {
    adminUserId: string;
    subjectUserId: string;
    pfpHash: string;
    decision: PfpAuditDecisionType;
    removeReason?: string | null;
    subjectUsername: string;
    subjectDisplayName: string | null;
    pfpUrl: string;
    pfpHistoryId?: string | null;
  },
): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO pfp_audit_decisions (
        id, admin_user_id, subject_user_id, pfp_hash, decision, remove_reason,
        subject_username, subject_display_name, pfp_url, pfp_history_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
      ON CONFLICT(admin_user_id, subject_user_id, pfp_hash) DO UPDATE SET
        decision = excluded.decision,
        remove_reason = excluded.remove_reason,
        subject_username = excluded.subject_username,
        subject_display_name = excluded.subject_display_name,
        pfp_url = excluded.pfp_url,
        pfp_history_id = COALESCE(excluded.pfp_history_id, pfp_audit_decisions.pfp_history_id),
        updated_at = unixepoch()`,
    )
      .bind(
        id,
        input.adminUserId,
        input.subjectUserId,
        input.pfpHash,
        input.decision,
        input.removeReason ?? null,
        input.subjectUsername,
        input.subjectDisplayName,
        input.pfpUrl,
        input.pfpHistoryId ?? null,
      )
      .run();

    const row = (await env.DB.prepare(
      `SELECT id FROM pfp_audit_decisions
       WHERE admin_user_id = ? AND subject_user_id = ? AND pfp_hash = ?`,
    )
      .bind(input.adminUserId, input.subjectUserId, input.pfpHash)
      .first()) as { id: string } | null;
    return row?.id ?? id;
  } catch {
    return null;
  }
}

export async function restoreSubjectPfpFromLatestHistory(
  env: Env,
  subjectUserId: string,
): Promise<{ pfpUrl: string; pfpHash: string } | null> {
  const historyRow = (await env.DB.prepare(
    "SELECT id, r2_key FROM pfp_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(subjectUserId)
    .first()) as { id: string; r2_key: string } | null;

  if (!historyRow) return null;

  const historyObject = await env.PFP_BUCKET.get(historyRow.r2_key);
  if (!historyObject) return null;

  try {
    await saveCurrentPfpToHistory(env, subjectUserId);
  } catch {
    // ignore
  }

  const processed = await processPfpUpload(await historyObject.arrayBuffer());
  const { pfpUrl, pfpHash } = await putCurrentPfp(env, subjectUserId, processed);
  await setPfpPendingReview(env, subjectUserId, true);
  return { pfpUrl, pfpHash };
}

/** Resolve admin by UUID, username, or email (case-insensitive). */
export async function resolveAdminUserId(env: Env, identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  try {
    const byId = (await env.DB.prepare("SELECT id FROM users WHERE id = ?")
      .bind(trimmed)
      .first()) as { id: string } | null;
    if (byId?.id) return byId.id;

    const byLogin = (await env.DB.prepare(
      "SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
    )
      .bind(trimmed, trimmed)
      .first()) as { id: string } | null;
    return byLogin?.id ?? null;
  } catch {
    return null;
  }
}

export async function listPfpAuditDecisions(
  env: Env,
  input: {
    adminUserId: string;
    limit?: number;
    cursorUpdatedAt?: number | null;
  },
): Promise<{ decisions: PfpAuditDecisionRow[]; nextCursor: number | null }> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  try {
    let query = `
      SELECT d.id, d.admin_user_id, a.username AS admin_username,
        d.subject_user_id, d.subject_username, d.subject_display_name,
        d.pfp_hash, d.pfp_url, d.pfp_history_id, d.decision, d.remove_reason,
        d.created_at, d.updated_at
      FROM pfp_audit_decisions d
      LEFT JOIN users a ON a.id = d.admin_user_id
      WHERE d.admin_user_id = ?`;
    const binds: unknown[] = [input.adminUserId];

    if (input.cursorUpdatedAt != null) {
      query += " AND d.updated_at < ?";
      binds.push(input.cursorUpdatedAt);
    }

    query += " ORDER BY d.updated_at DESC LIMIT ?";
    binds.push(limit + 1);

    const rows = await env.DB.prepare(query)
      .bind(...binds)
      .all();

    const list = (rows.results || []) as {
      id: string;
      admin_user_id: string;
      admin_username: string | null;
      subject_user_id: string;
      subject_username: string;
      subject_display_name: string | null;
      pfp_hash: string;
      pfp_url: string;
      pfp_history_id: string | null;
      decision: PfpAuditDecisionType;
      remove_reason: string | null;
      created_at: number;
      updated_at: number;
    }[];

    const hasMore = list.length > limit;
    const page = hasMore ? list.slice(0, limit) : list;

    return {
      decisions: page.map((row) => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        adminUsername: row.admin_username,
        subjectUserId: row.subject_user_id,
        subjectUsername: row.subject_username,
        subjectDisplayName: row.subject_display_name,
        pfpHash: row.pfp_hash,
        pfpUrl: row.pfp_url,
        pfpHistoryId: row.pfp_history_id,
        decision: row.decision,
        removeReason: row.remove_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      nextCursor: hasMore ? page[page.length - 1].updated_at : null,
    };
  } catch {
    return { decisions: [], nextCursor: null };
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

export async function getPfpAuditDecisionForAdmin(
  env: Env,
  adminUserId: string,
  subjectUserId: string,
  pfpHash: string,
): Promise<PfpAuditDecisionRow | null> {
  try {
    const row = (await env.DB.prepare(
      `SELECT d.id, d.admin_user_id, a.username AS admin_username,
        d.subject_user_id, d.subject_username, d.subject_display_name,
        d.pfp_hash, d.pfp_url, d.pfp_history_id, d.decision, d.remove_reason,
        d.created_at, d.updated_at
       FROM pfp_audit_decisions d
       LEFT JOIN users a ON a.id = d.admin_user_id
       WHERE d.admin_user_id = ? AND d.subject_user_id = ? AND d.pfp_hash = ?`,
    )
      .bind(adminUserId, subjectUserId, pfpHash)
      .first()) as {
      id: string;
      admin_user_id: string;
      admin_username: string | null;
      subject_user_id: string;
      subject_username: string;
      subject_display_name: string | null;
      pfp_hash: string;
      pfp_url: string;
      pfp_history_id: string | null;
      decision: PfpAuditDecisionType;
      remove_reason: string | null;
      created_at: number;
      updated_at: number;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      adminUserId: row.admin_user_id,
      adminUsername: row.admin_username,
      subjectUserId: row.subject_user_id,
      subjectUsername: row.subject_username,
      subjectDisplayName: row.subject_display_name,
      pfpHash: row.pfp_hash,
      pfpUrl: row.pfp_url,
      pfpHistoryId: row.pfp_history_id,
      decision: row.decision,
      removeReason: row.remove_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}
