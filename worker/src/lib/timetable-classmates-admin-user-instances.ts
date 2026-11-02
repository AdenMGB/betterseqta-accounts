import type { Env } from "../types/env";

export type AdminUserTqInstanceRow = {
  membershipId: string;
  instanceHost: string;
  seqtaStudentId: number;
  seqtaPersonUuid: string;
  optedInAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  active: boolean;
  isInstanceCoordinator: boolean;
  hasRelayShare: boolean;
};

export type AdminUserTqInstancesResult = {
  available: boolean;
  userId: string;
  instances: AdminUserTqInstanceRow[];
};

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table|does not exist/i.test(msg);
}

export async function listTqInstancesForCloudUser(
  db: Env["DB"],
  cloudUserId: string,
): Promise<AdminUserTqInstancesResult> {
  const empty: AdminUserTqInstancesResult = { available: false, userId: cloudUserId, instances: [] };

  try {
    const { results } = await db
      .prepare(
        `SELECT m.id AS membership_id,
          m.instance_host,
          m.seqta_student_id,
          m.seqta_person_uuid,
          m.opted_in_at,
          m.last_seen_at,
          m.revoked_at,
          CASE WHEN m.revoked_at IS NULL THEN 1 ELSE 0 END AS active,
          CASE WHEN i.coordinator_cloud_user_id = m.cloud_user_id THEN 1 ELSE 0 END AS is_instance_coordinator,
          CASE WHEN rs.seqta_student_id IS NOT NULL THEN 1 ELSE 0 END AS has_relay_share
         FROM tq_membership m
         LEFT JOIN tq_instance i ON i.instance_host = m.instance_host
         LEFT JOIN tq_relay_share rs
           ON rs.instance_host = m.instance_host
          AND rs.seqta_student_id = m.seqta_student_id
          AND rs.cloud_user_id = m.cloud_user_id
         WHERE m.cloud_user_id = ?
         ORDER BY active DESC, m.last_seen_at DESC, m.instance_host ASC`,
      )
      .bind(cloudUserId)
      .all<{
        membership_id: string;
        instance_host: string;
        seqta_student_id: number;
        seqta_person_uuid: string;
        opted_in_at: string;
        last_seen_at: string;
        revoked_at: string | null;
        active: number;
        is_instance_coordinator: number;
        has_relay_share: number;
      }>();

    return {
      available: true,
      userId: cloudUserId,
      instances: (results ?? []).map((row) => ({
        membershipId: row.membership_id,
        instanceHost: row.instance_host,
        seqtaStudentId: row.seqta_student_id,
        seqtaPersonUuid: row.seqta_person_uuid,
        optedInAt: row.opted_in_at,
        lastSeenAt: row.last_seen_at,
        revokedAt: row.revoked_at,
        active: row.active === 1,
        isInstanceCoordinator: row.is_instance_coordinator === 1,
        hasRelayShare: row.has_relay_share === 1,
      })),
    };
  } catch (err) {
    if (isMissingTableError(err)) return empty;
    throw err;
  }
}
