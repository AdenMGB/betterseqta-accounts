import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseInstallId, parseInstallLinkBody, parseExtensionMeta } from "../src/lib/bsplus-installs.ts";

describe("bsplus install link parsing", () => {
  it("accepts valid link body", () => {
    const parsed = parseInstallLinkBody({
      installId: "550e8400-e29b-41d4-a716-446655440000",
      extension: { version: "3.7.0", channel: "stable", browser: "chrome" },
      deviceName: "Aden's Chrome",
      lastSeenAt: "2026-11-02T00:00:00.000Z",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.installId, "550e8400-e29b-41d4-a716-446655440000");
    assert.equal(parsed.extension.channel, "stable");
    assert.equal(parsed.deviceName, "Aden's Chrome");
    assert.equal(parsed.lastSeenAt, "2026-11-02T00:00:00.000Z");
  });

  it("rejects invalid installId", () => {
    assert.equal(parseInstallId("not-a-uuid"), null);
    const parsed = parseInstallLinkBody({
      installId: "bad",
      extension: { version: "1.0.0", channel: "stable", browser: "chrome" },
      lastSeenAt: "2026-11-02T00:00:00.000Z",
    });
    assert.ok("error" in parsed);
  });

  it("normalizes unknown channel", () => {
    const ext = parseExtensionMeta({ version: "1.0.0", channel: "beta", browser: "chrome" });
    assert.equal(ext?.channel, "unknown");
  });
});
