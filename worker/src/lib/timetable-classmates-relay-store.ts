import {
  isValidPeriod,
  sanitizeBundles,
  sortSharesByUpdatedAt,
  type RelayBundle,
  type StoredShare,
} from "./timetable-classmates-relay-types";

type ShareRow = {
  seqta_student_id: number;
  cloud_user_id: string;
  share_code: string;
  period_from: string;
  period_until: string;
  updated_at: number;
  bundles_json: string;
};

function rowToShare(row: ShareRow): StoredShare | null {
  if (
    !Number.isInteger(row.seqta_student_id) ||
    row.seqta_student_id <= 0 ||
    typeof row.cloud_user_id !== "string" ||
    !row.cloud_user_id ||
    typeof row.share_code !== "string" ||
    !row.share_code
  ) {
    return null;
  }
  const period = { from: row.period_from, until: row.period_until };
  if (!isValidPeriod(period)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.bundles_json);
  } catch {
    return null;
  }
  const bundles = sanitizeBundles(parsed);
  if (bundles.length === 0) return null;
  if (typeof row.updated_at !== "number" || !Number.isFinite(row.updated_at)) return null;

  return {
    seqta_student_id: row.seqta_student_id,
    cloud_user_id: row.cloud_user_id,
    share_code: row.share_code,
    period,
    updated_at: row.updated_at,
    bundles,
  };
}

export async function loadSharesForInstance(db: D1Database, instanceHost: string): Promise<StoredShare[]> {
  const { results } = await db
    .prepare(
      `SELECT seqta_student_id, cloud_user_id, share_code, period_from, period_until, updated_at, bundles_json
       FROM tq_relay_share
       WHERE instance_host = ?`,
    )
    .bind(instanceHost)
    .all<ShareRow>();

  const shares: StoredShare[] = [];
  for (const row of results ?? []) {
    const share = rowToShare(row);
    if (share) shares.push(share);
  }
  return sortSharesByUpdatedAt(shares);
}

export async function upsertShare(db: D1Database, instanceHost: string, share: StoredShare): Promise<void> {
  const bundles = sanitizeBundles(share.bundles) as RelayBundle[];
  if (bundles.length === 0) {
    throw new Error("Share has no valid bundles");
  }
  if (!isValidPeriod(share.period)) {
    throw new Error("Share has invalid period");
  }

  await db
    .prepare(
      `INSERT INTO tq_relay_share (
         instance_host, seqta_student_id, cloud_user_id, share_code,
         period_from, period_until, updated_at, bundles_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(instance_host, seqta_student_id) DO UPDATE SET
         cloud_user_id = excluded.cloud_user_id,
         share_code = excluded.share_code,
         period_from = excluded.period_from,
         period_until = excluded.period_until,
         updated_at = excluded.updated_at,
         bundles_json = excluded.bundles_json`,
    )
    .bind(
      instanceHost,
      share.seqta_student_id,
      share.cloud_user_id,
      share.share_code,
      share.period.from,
      share.period.until,
      share.updated_at,
      JSON.stringify(bundles),
    )
    .run();
}

export async function deleteShare(
  db: D1Database,
  instanceHost: string,
  seqtaStudentId: number,
): Promise<void> {
  await db
    .prepare(`DELETE FROM tq_relay_share WHERE instance_host = ? AND seqta_student_id = ?`)
    .bind(instanceHost, seqtaStudentId)
    .run();
}
