import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeJwt } from "jose";
import { createRelayToken, verifyRelayToken } from "../src/lib/timetable-classmates-relay-token.ts";

const secret = new TextEncoder().encode("test-relay-secret-min-32-chars!!");

describe("relay JWT", () => {
  it("does not embed bundle_key in relay_token", async () => {
    const token = await createRelayToken(
      {
        typ: "tq_relay",
        instance_host: "learn.example.edu.au",
        cloud_user_id: "550e8400-e29b-41d4-a716-446655440000",
        seqta_student_id: 18,
        share_code: "083f5e95",
      },
      secret,
    );
    const decoded = decodeJwt(token);
    assert.equal("bundle_key_b64" in decoded, false);
    const verified = await verifyRelayToken(token, secret);
    assert.ok(verified);
    assert.equal(verified?.instance_host, "learn.example.edu.au");
  });
});
