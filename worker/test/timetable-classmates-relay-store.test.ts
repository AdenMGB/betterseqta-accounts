import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deleteShare,
  loadSharesForInstance,
  upsertShare,
} from "../src/lib/timetable-classmates-relay-store.ts";
import { sortSharesByUpdatedAt, type StoredShare } from "../src/lib/timetable-classmates-relay-types.ts";

type Row = {
  instance_host: string;
  seqta_student_id: number;
  cloud_user_id: string;
  share_code: string;
  period_from: string;
  period_until: string;
  updated_at: number;
  bundles_json: string;
};

function makeMockDb(initial: Row[] = []) {
  const rows = new Map<string, Row>();
  for (const row of initial) {
    rows.set(`${row.instance_host}:${row.seqta_student_id}`, { ...row });
  }

  const db = {
    prepare(sql: string) {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async all<T>() {
          if (sql.includes("FROM tq_relay_share") && sql.includes("WHERE instance_host")) {
            const instanceHost = binds[0] as string;
            const results = [...rows.values()].filter((r) => r.instance_host === instanceHost);
            return { results: results as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          if (sql.includes("INSERT INTO tq_relay_share")) {
            const [
              instance_host,
              seqta_student_id,
              cloud_user_id,
              share_code,
              period_from,
              period_until,
              updated_at,
              bundles_json,
            ] = binds as Row[keyof Row][];
            rows.set(`${instance_host}:${seqta_student_id}`, {
              instance_host: instance_host as string,
              seqta_student_id: seqta_student_id as number,
              cloud_user_id: cloud_user_id as string,
              share_code: share_code as string,
              period_from: period_from as string,
              period_until: period_until as string,
              updated_at: updated_at as number,
              bundles_json: bundles_json as string,
            });
          }
          if (sql.includes("DELETE FROM tq_relay_share")) {
            const [instance_host, seqta_student_id] = binds as [string, number];
            rows.delete(`${instance_host}:${seqta_student_id}`);
          }
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };

  return { db: db as D1Database, rows };
}

const sampleBundle = {
  class_key: "cr:v1:1",
  iv_b64: "aa==",
  ct_b64: "bb==",
};

function sampleShare(overrides: Partial<StoredShare> = {}): StoredShare {
  return {
    seqta_student_id: 100,
    cloud_user_id: "user-1",
    share_code: "abcd1234",
    period: { from: "2026-01-01", until: "2026-12-31" },
    updated_at: 1000,
    bundles: [sampleBundle],
    ...overrides,
  };
}

describe("timetable-classmates-relay-store", () => {
  it("upserts and loads shares for an instance", async () => {
    const { db } = makeMockDb();
    await upsertShare(db, "school.example.edu.au", sampleShare());
    const loaded = await loadSharesForInstance(db, "school.example.edu.au");
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0]?.seqta_student_id, 100);
    assert.equal(loaded[0]?.bundles[0]?.class_key, "cr:v1:1");
  });

  it("deletes a share by student id", async () => {
    const { db } = makeMockDb();
    await upsertShare(db, "school.example.edu.au", sampleShare());
    await deleteShare(db, "school.example.edu.au", 100);
    const loaded = await loadSharesForInstance(db, "school.example.edu.au");
    assert.equal(loaded.length, 0);
  });

  it("sorts shares by updated_at descending", () => {
    const sorted = sortSharesByUpdatedAt([
      sampleShare({ seqta_student_id: 1, updated_at: 100 }),
      sampleShare({ seqta_student_id: 2, updated_at: 300 }),
      sampleShare({ seqta_student_id: 3, updated_at: 200 }),
    ]);
    assert.deepEqual(
      sorted.map((s) => s.seqta_student_id),
      [2, 3, 1],
    );
  });

  it("skips rows with invalid bundle JSON on load", async () => {
    const { db } = makeMockDb([
      {
        instance_host: "school.example.edu.au",
        seqta_student_id: 1,
        cloud_user_id: "u1",
        share_code: "abcd1234",
        period_from: "2026-01-01",
        period_until: "2026-12-31",
        updated_at: 1,
        bundles_json: "not-json",
      },
    ]);
    const loaded = await loadSharesForInstance(db, "school.example.edu.au");
    assert.equal(loaded.length, 0);
  });
});
