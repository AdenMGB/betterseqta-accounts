import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSparseDiff,
  hydrateWithDefaults,
  hydrationAddedKeys,
  pickChangedPatch,
  sanitizeIncomingPatch,
  shallowMergePatch,
  stripEnvelopeKeys,
} from "../src/lib/settings-patch.ts";
import { desqtaLocalOnly } from "../src/settings/local-only.ts";

describe("settings-patch", () => {
  it("hydrateWithDefaults adds missing keys only", () => {
    const stored = { theme: "dark" };
    const defaults = { theme: "light", accent_color: "#000" };
    const hydrated = hydrateWithDefaults(stored, defaults);
    assert.equal(hydrated.theme, "dark");
    assert.equal(hydrated.accent_color, "#000");
    assert.equal(hydrationAddedKeys(stored, hydrated), true);
  });

  it("shallowMergePatch replaces keys at top level", () => {
    const current = { a: 1, b: { x: 1 } };
    const patch = { b: { y: 2 } };
    const merged = shallowMergePatch(current, patch);
    assert.deepEqual(merged.b, { y: 2 });
    assert.equal(merged.a, 1);
  });

  it("buildSparseDiff returns only changed keys", () => {
    const baseline = { theme: "dark", zoom: 100 };
    const target = { theme: "dark", zoom: 110, lang: "en" };
    const diff = buildSparseDiff(baseline, target);
    assert.deepEqual(diff, { zoom: 110, lang: "en" });
  });

  it("pickChangedPatch drops no-op keys", () => {
    const current = { theme: "dark" };
    const incoming = { theme: "dark", accent_color: "#fff" };
    const patch = pickChangedPatch(current, incoming);
    assert.deepEqual(patch, { accent_color: "#fff" });
  });

  it("stripEnvelopeKeys removes ok and server", () => {
    const obj = { ok: true, server: {}, theme: "dark" };
    assert.deepEqual(stripEnvelopeKeys(obj), { theme: "dark" });
  });

  it("sanitizeIncomingPatch removes local-only DesQTA keys", () => {
    const obj = {
      theme: "dark",
      cloud_settings_server_revision: 5,
      dashboard_widgets_layout: [],
    };
    const out = sanitizeIncomingPatch(obj, desqtaLocalOnly);
    assert.deepEqual(out, { theme: "dark" });
  });

  it("deepEqual handles nested objects in buildSparseDiff", () => {
    const baseline = { shortcuts: [{ name: "A", url: "https://a" }] };
    const target = { shortcuts: [{ name: "A", url: "https://b" }] };
    const diff = buildSparseDiff(baseline, target);
    assert.ok("shortcuts" in diff);
  });
});
