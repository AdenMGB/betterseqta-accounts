import assert from "node:assert/strict";
import { test } from "node:test";
import { PFP_AUDIT_APPROVALS_REQUIRED } from "../src/lib/pfpAuditReview";

test("PFP audit requires two distinct admin acceptances", () => {
  assert.equal(PFP_AUDIT_APPROVALS_REQUIRED, 2);
});
