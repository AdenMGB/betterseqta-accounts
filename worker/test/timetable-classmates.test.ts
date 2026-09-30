import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIdentityBindingCanonical,
  computeIdentityBindingDigest,
  currentUtcIsoWeek,
  normalizeInstanceHost,
  parseAttestedAt,
  parseIdentityBindingDigest,
  parseSeqtaPersonUuid,
  parseSeqtaStudentId,
  planSyncHint,
} from "../src/lib/timetable-classmates.ts";

describe("timetable classmates validation", () => {
  it("accepts normalized SEQTA instance hostnames", () => {
    assert.equal(normalizeInstanceHost("learn.integration.site.seqta.com.au"), "learn.integration.site.seqta.com.au");
    assert.equal(normalizeInstanceHost("  learn.example.edu.au  "), "learn.example.edu.au");
  });

  it("rejects hosts with scheme or path", () => {
    assert.equal(normalizeInstanceHost("https://learn.example.edu.au"), null);
    assert.equal(normalizeInstanceHost("learn.example.edu.au/path"), null);
  });

  it("validates student id and person uuid", () => {
    assert.equal(parseSeqtaStudentId(18), 18);
    assert.equal(parseSeqtaStudentId(0), null);
    assert.equal(parseSeqtaPersonUuid("03c5f6e3-b27e-42e1-bece-27c6526205a8"), "03c5f6e3-b27e-42e1-bece-27c6526205a8");
    assert.equal(parseSeqtaPersonUuid("not-a-uuid"), null);
  });
});

describe("identity binding digest", () => {
  it("builds canonical v1 string with optional account type", () => {
    const canonical = buildIdentityBindingCanonical({
      version: 1,
      instanceHost: "learn.example.edu.au",
      seqtaStudentId: 18,
      seqtaPersonUuid: "03c5f6e3-b27e-42e1-bece-27c6526205a8",
      cloudUserId: "550E8400-E29B-41D4-A716-446655440000",
      seqtaAccountType: "student",
    });
    assert.equal(
      canonical,
      [
        "v=1",
        "instance=learn.example.edu.au",
        "student=18",
        "person=03c5f6e3-b27e-42e1-bece-27c6526205a8",
        "cloud=550e8400-e29b-41d4-a716-446655440000",
        "type=student",
      ].join("\n"),
    );
  });

  it("computes stable sha256 hex digest", async () => {
    const digest = await computeIdentityBindingDigest({
      version: 1,
      instanceHost: "learn.example.edu.au",
      seqtaStudentId: 18,
      seqtaPersonUuid: "03c5f6e3-b27e-42e1-bece-27c6526205a8",
      cloudUserId: "550e8400-e29b-41d4-a716-446655440000",
      seqtaAccountType: "student",
    });
    assert.equal(parseIdentityBindingDigest(digest), digest);
    assert.equal(digest.length, 64);
  });

  it("accepts attested_at within ±15 minutes", () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    assert.equal(parseAttestedAt("2026-09-30T12:10:00.000Z", now), true);
    assert.equal(parseAttestedAt("2026-09-30T12:20:00.000Z", now), false);
  });
});

describe("currentUtcIsoWeek", () => {
  it("matches ISO week for a known UTC date", () => {
    assert.equal(currentUtcIsoWeek(new Date("2026-09-30T12:00:00.000Z")), "2026-W40");
  });
});

describe("planSyncHint coordinator", () => {
  const members = [
    {
      cloud_user_id: "user-a",
      last_seen_at: "2026-09-29T00:00:00.000Z",
      opted_in_at: "2026-09-01T00:00:00.000Z",
    },
    {
      cloud_user_id: "user-b",
      last_seen_at: "2026-09-28T00:00:00.000Z",
      opted_in_at: "2026-09-02T00:00:00.000Z",
    },
  ];

  it("rotates thread subject when publish week changes", () => {
    const plan = planSyncHint(
      {
        publish_week: "2026-W39",
        thread_subject: "BQ+TIMETABLE:v1:WEEK:2026-W39:deadbeef",
        coordinator_cloud_user_id: "user-b",
      },
      members,
      "user-a",
      new Date("2026-09-30T12:00:00.000Z"),
    );
    assert.equal(plan.publishWeek, "2026-W40");
    assert.match(plan.threadSubject, /^BQ\+TIMETABLE:v1:WEEK:2026-W40:[0-9a-f]{8}$/);
    assert.equal(plan.coordinatorCloudUserId, "user-a");
    assert.equal(plan.shouldPublish, true);
  });

  it("keeps thread subject when coordinator is stale mid-week", () => {
    const subject = "BQ+TIMETABLE:v1:WEEK:2026-W40:abc12345";
    const staleMembers = [
      {
        cloud_user_id: "user-a",
        last_seen_at: "2026-09-29T00:00:00.000Z",
        opted_in_at: "2026-09-01T00:00:00.000Z",
      },
      {
        cloud_user_id: "user-b",
        last_seen_at: "2026-09-01T00:00:00.000Z",
        opted_in_at: "2026-08-01T00:00:00.000Z",
      },
    ];
    const plan = planSyncHint(
      {
        publish_week: "2026-W40",
        thread_subject: subject,
        coordinator_cloud_user_id: "user-b",
      },
      staleMembers,
      "user-a",
      new Date("2026-09-30T12:00:00.000Z"),
    );
    assert.equal(plan.threadSubject, subject);
    assert.equal(plan.coordinatorCloudUserId, "user-a");
    assert.equal(plan.shouldPublish, true);
  });
});
