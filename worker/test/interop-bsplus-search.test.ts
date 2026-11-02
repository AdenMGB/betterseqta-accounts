import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInteropUserSearchWhere } from "../src/lib/interopBsplusSearch.ts";

describe("interopBsplusSearch", () => {
  it("builds user search where with signup number for numeric q", () => {
    const { whereClause, params } = buildInteropUserSearchWhere("42");
    assert.match(whereClause, /signup_number = \?/);
    assert.equal(params.filter((p) => p === 42).length, 1);
  });

  it("builds user search where without signup for text q", () => {
    const { whereClause } = buildInteropUserSearchWhere("alice");
    assert.doesNotMatch(whereClause, /signup_number/);
  });
});
