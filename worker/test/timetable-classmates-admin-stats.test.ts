import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTimetableClassmatesAdminStats } from "../src/lib/timetable-classmates-admin-stats.ts";

describe("getTimetableClassmatesAdminStats", () => {
  it("returns unavailable when tq_membership table is missing", async () => {
    const db = {
      prepare() {
        return {
          first: async () => {
            throw new Error("no such table: tq_membership");
          },
          all: async () => ({ results: [] }),
          bind: () => ({ first: async () => { throw new Error("no such table"); }, all: async () => ({ results: [] }) }),
        };
      },
    } as Parameters<typeof getTimetableClassmatesAdminStats>[0];

    const stats = await getTimetableClassmatesAdminStats(db);
    assert.equal(stats.available, false);
    assert.equal(stats.active_opt_ins, 0);
    assert.equal(stats.relay_share_total, 0);
  });

  it("includes relay share totals and per-instance counts", async () => {
    const membershipQueries: Record<string, number | { instance_host: string; active_count: number }[]> = {
      "SELECT COUNT(*) AS c FROM tq_membership WHERE revoked_at IS NULL": 5,
      "SELECT COUNT(*) AS c FROM tq_membership WHERE revoked_at IS NOT NULL": 1,
      "SELECT COUNT(DISTINCT instance_host) AS c FROM tq_membership WHERE revoked_at IS NULL": 2,
      "SELECT COUNT(*) AS c FROM tq_membership WHERE revoked_at IS NULL AND last_seen_at >=": 3,
      "GROUP BY instance_host": [
        { instance_host: "school-a.edu.au", active_count: 4 },
        { instance_host: "school-b.edu.au", active_count: 1 },
      ],
    };

    const db = {
      prepare(sql: string) {
        const stmt = {
          binds: [] as unknown[],
          bind(...args: unknown[]) {
            this.binds = args;
            return stmt;
          },
          async first<T>() {
            if (sql.includes("FROM tq_relay_share") && !sql.includes("GROUP BY")) {
              return { c: 3 } as T;
            }
            if (sql.includes("revoked_at IS NOT NULL")) return { c: 1 } as T;
            if (sql.includes("DISTINCT instance_host")) return { c: 2 } as T;
            if (sql.includes("last_seen_at >=")) return { c: 3 } as T;
            if (sql.includes("revoked_at IS NULL")) return { c: 5 } as T;
            return { c: 0 } as T;
          },
          async all<T>() {
            if (sql.includes("FROM tq_relay_share") && sql.includes("GROUP BY")) {
              return {
                results: [
                  { instance_host: "school-a.edu.au", relay_share_count: 2 },
                  { instance_host: "school-b.edu.au", relay_share_count: 1 },
                ],
              } as { results: T[] };
            }
            if (sql.includes("GROUP BY instance_host")) {
              return { results: membershipQueries["GROUP BY instance_host"] } as { results: T[] };
            }
            return { results: [] as T[] };
          },
        };
        return stmt;
      },
    } as Parameters<typeof getTimetableClassmatesAdminStats>[0];

    const stats = await getTimetableClassmatesAdminStats(db);
    assert.equal(stats.available, true);
    assert.equal(stats.relay_share_total, 3);
    assert.deepEqual(
      stats.by_instance.map((r) => ({
        instance_host: r.instance_host,
        active_count: r.active_count,
        relay_share_count: r.relay_share_count,
      })),
      [
        { instance_host: "school-a.edu.au", active_count: 4, relay_share_count: 2 },
        { instance_host: "school-b.edu.au", active_count: 1, relay_share_count: 1 },
      ],
    );
  });
});
