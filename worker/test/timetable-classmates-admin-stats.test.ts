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
  });
});
