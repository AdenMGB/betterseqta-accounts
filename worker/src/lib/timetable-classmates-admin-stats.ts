import type { Env } from "../types/env";

export type TimetableClassmatesByInstance = {
  instance_host: string;
  active_count: number;
};

export type TimetableClassmatesAdminStats = {
  available: boolean;
  active_opt_ins: number;
  revoked_total: number;
  school_instances: number;
  active_last_24h: number;
  active_last_7d: number;
  by_instance: TimetableClassmatesByInstance[];
};

const EMPTY: TimetableClassmatesAdminStats = {
  available: false,
  active_opt_ins: 0,
  revoked_total: 0,
  school_instances: 0,
  active_last_24h: 0,
  active_last_7d: 0,
  by_instance: [],
};

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table|does not exist/i.test(msg);
}

export async function getTimetableClassmatesAdminStats(db: Env["DB"]): Promise<TimetableClassmatesAdminStats> {
  try {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const activeRow = await db
      .prepare("SELECT COUNT(*) AS c FROM tq_membership WHERE revoked_at IS NULL")
      .first<{ c: number }>();
    const revokedRow = await db
      .prepare("SELECT COUNT(*) AS c FROM tq_membership WHERE revoked_at IS NOT NULL")
      .first<{ c: number }>();
    const instancesRow = await db
      .prepare(
        `SELECT COUNT(DISTINCT instance_host) AS c FROM tq_membership WHERE revoked_at IS NULL`,
      )
      .first<{ c: number }>();
    const last24Row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM tq_membership WHERE revoked_at IS NULL AND last_seen_at >= ?`,
      )
      .bind(since24h)
      .first<{ c: number }>();
    const last7Row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM tq_membership WHERE revoked_at IS NULL AND last_seen_at >= ?`,
      )
      .bind(since7d)
      .first<{ c: number }>();

    const { results } = await db
      .prepare(
        `SELECT instance_host, COUNT(*) AS active_count
         FROM tq_membership
         WHERE revoked_at IS NULL
         GROUP BY instance_host
         ORDER BY active_count DESC, instance_host ASC
         LIMIT 100`,
      )
      .all<{ instance_host: string; active_count: number }>();

    return {
      available: true,
      active_opt_ins: Number(activeRow?.c ?? 0),
      revoked_total: Number(revokedRow?.c ?? 0),
      school_instances: Number(instancesRow?.c ?? 0),
      active_last_24h: Number(last24Row?.c ?? 0),
      active_last_7d: Number(last7Row?.c ?? 0),
      by_instance: (results ?? []).map((row) => ({
        instance_host: row.instance_host,
        active_count: Number(row.active_count),
      })),
    };
  } catch (err) {
    if (isMissingTableError(err)) return EMPTY;
    throw err;
  }
}
