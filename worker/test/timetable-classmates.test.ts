import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIdentityBindingCanonical,
  computeIdentityBindingDigest,
  normalizeInstanceHost,
  parseAttestedAt,
  parseIdentityBindingDigest,
  parseSeqtaPersonUuid,
  parseSeqtaStudentId,
  shareCodeFromIdentityDigest,
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
    assert.equal(shareCodeFromIdentityDigest(digest), digest.slice(0, 8));
  });

  it("accepts attested_at within ±15 minutes", () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    assert.equal(parseAttestedAt("2026-09-30T12:10:00.000Z", now), true);
    assert.equal(parseAttestedAt("2026-09-30T12:20:00.000Z", now), false);
  });
});
