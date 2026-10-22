import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  complianceComplete,
  complianceFlagsFromRow,
  validateComplianceAck,
} from "../src/lib/userCompliance.ts";

describe("userCompliance", () => {
  it("validateComplianceAck requires both acknowledgments", () => {
    assert.equal(validateComplianceAck({}), "You must agree to the privacy policy.");
    assert.equal(
      validateComplianceAck({ privacyPolicyAccepted: true }),
      "You must confirm that you are over the age of 13.",
    );
    assert.equal(validateComplianceAck({ privacyPolicyAccepted: true, age13Confirmed: true }), null);
  });

  it("complianceFlagsFromRow maps timestamps to booleans", () => {
    assert.deepEqual(complianceFlagsFromRow({}), {
      privacy_policy_accepted: false,
      age_13_confirmed: false,
    });
    assert.deepEqual(
      complianceFlagsFromRow({ privacy_policy_accepted_at: 1, age_13_confirmed_at: 2 }),
      { privacy_policy_accepted: true, age_13_confirmed: true },
    );
  });

  it("complianceComplete is true only when both flags are set", () => {
    assert.equal(complianceComplete({ privacy_policy_accepted: true }), false);
    assert.equal(
      complianceComplete({ privacy_policy_accepted: true, age_13_confirmed: true }),
      true,
    );
  });
});
