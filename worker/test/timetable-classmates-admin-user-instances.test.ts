import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listTqInstancesForCloudUser } from "../src/lib/timetable-classmates-admin-user-instances";

describe("listTqInstancesForCloudUser", () => {
  it("returns unavailable when tq_membership table is missing", async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => {
            throw new Error("no such table: tq_membership");
          },
        }),
      }),
    } as unknown as D1Database;

    const result = await listTqInstancesForCloudUser(db, "user-1");
    assert.equal(result.available, false);
    assert.deepEqual(result.instances, []);
  });

  it("maps membership rows", async () => {
    const db = {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          all: async () => {
            assert.match(sql, /FROM tq_membership m/);
            return {
              results: [
                {
                  membership_id: "m1",
                  instance_host: "student.example.edu.au",
                  seqta_student_id: 42,
                  seqta_person_uuid: "person-uuid",
                  opted_in_at: "2026-01-01T00:00:00.000Z",
                  last_seen_at: "2026-02-01T00:00:00.000Z",
                  revoked_at: null,
                  active: 1,
                  is_instance_coordinator: 0,
                  has_relay_share: 1,
                },
              ],
            };
          },
        }),
      }),
    } as unknown as D1Database;

    const result = await listTqInstancesForCloudUser(db, "user-1");
    assert.equal(result.available, true);
    assert.equal(result.instances.length, 1);
    assert.equal(result.instances[0].instanceHost, "student.example.edu.au");
    assert.equal(result.instances[0].active, true);
    assert.equal(result.instances[0].hasRelayShare, true);
  });
});
