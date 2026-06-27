import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MICROSOFT_CALENDAR_CALLBACK_URI } from "../src/routes/microsoft-calendar.ts";

describe("microsoft calendar oauth", () => {
  it("uses the canonical accounts callback URI", () => {
    assert.equal(
      MICROSOFT_CALENDAR_CALLBACK_URI,
      "https://accounts.betterseqta.org/auth/microsoft/calendar/callback",
    );
  });
});
