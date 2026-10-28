import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  complianceComplete,
  complianceFlagsFromRow,
  validateComplianceAck,
} from "../src/lib/userCompliance.ts";

describe("userCompliance", () => {
  it("validateComplianceAck requires all acknowledgments", () => {
    assert.equal(validateComplianceAck({}), "You must agree to the privacy policy.");
    assert.equal(
      validateComplianceAck({ privacyPolicyAccepted: true }),
      "You must agree to the terms of service.",
    );
    assert.equal(
      validateComplianceAck({ privacyPolicyAccepted: true, termsOfServiceAccepted: true }),
      "You must confirm that you are over the age of 13.",
    );
    assert.equal(
      validateComplianceAck({
        privacyPolicyAccepted: true,
        termsOfServiceAccepted: true,
        age13Confirmed: true,
      }),
      null,
    );
  });

  it("complianceFlagsFromRow maps timestamps to booleans", () => {
    assert.deepEqual(complianceFlagsFromRow({}), {
      privacy_policy_accepted: false,
      terms_of_service_accepted: false,
      age_13_confirmed: false,
    });
    assert.deepEqual(
      complianceFlagsFromRow({
        privacy_policy_accepted_at: 1,
        terms_of_service_accepted_at: 2,
        age_13_confirmed_at: 3,
      }),
      {
        privacy_policy_accepted: true,
        terms_of_service_accepted: true,
        age_13_confirmed: true,
      },
    );
  });

  it("complianceComplete is true only when all flags are set", () => {
    assert.equal(complianceComplete({ privacy_policy_accepted: true }), false);
    assert.equal(
      complianceComplete({
        privacy_policy_accepted: true,
        terms_of_service_accepted: true,
        age_13_confirmed: true,
      }),
      true,
    );
  });
});
