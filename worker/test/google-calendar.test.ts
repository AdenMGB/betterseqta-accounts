import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GOOGLE_CALENDAR_CALLBACK_URI } from "../src/routes/google-calendar.ts";

describe("google calendar oauth", () => {
  it("uses the canonical accounts callback URI", () => {
    assert.equal(GOOGLE_CALENDAR_CALLBACK_URI, "https://accounts.betterseqta.org/auth/google/calendar/callback");
  });
});
