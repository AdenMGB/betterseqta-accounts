import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeHtml } from "../src/lib/html-escape.ts";
import { isValidDesqtaRedirectUri, isValidBsplusRedirectUri, isPersistentReservedRedirectUri } from "../src/lib/redirect-uri.ts";
import { isReservedClientExpired, expiresAtForReservedClient } from "../src/lib/desqta-client.ts";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    assert.equal(escapeHtml(`Hello <script>alert("x")</script>`), "Hello &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("escapes ampersands and quotes", () => {
    assert.equal(escapeHtml(`Tom & Jerry's "cafe"`), "Tom &amp; Jerry&#39;s &quot;cafe&quot;");
  });
});

describe("redirect-uri allowlist", () => {
  it("accepts valid desqta custom scheme URIs", () => {
    assert.equal(isValidDesqtaRedirectUri("desqta://auth/callback"), true);
  });

  it("rejects http and https redirect URIs for desqta", () => {
    assert.equal(isValidDesqtaRedirectUri("https://evil.example/callback"), false);
    assert.equal(isValidDesqtaRedirectUri("http://evil.example/callback"), false);
  });

  it("accepts documented bsplus redirect patterns", () => {
    assert.equal(isValidBsplusRedirectUri("https://accounts.betterseqta.org/auth/bsplus/callback"), true);
    assert.equal(isValidBsplusRedirectUri("chrome-extension://abc123/auth/callback"), true);
    assert.equal(isValidBsplusRedirectUri("bsplus://auth/callback"), true);
  });

  it("rejects arbitrary https URIs for bsplus", () => {
    assert.equal(isValidBsplusRedirectUri("https://evil.example/steal"), false);
  });
});

describe("persistent reserved clients", () => {
  it("treats known BS+ and DesQTA redirect URIs as non-expiring", () => {
    assert.equal(isPersistentReservedRedirectUri("desqta://auth/callback"), true);
    assert.equal(
      isPersistentReservedRedirectUri("https://accounts.betterseqta.org/auth/bsplus/callback"),
      true,
    );
    assert.equal(isPersistentReservedRedirectUri("chrome-extension://abc/auth/callback"), true);
    assert.equal(isPersistentReservedRedirectUri("https://evil.example/callback"), false);
  });

  it("never reports expiry for persistent redirect URIs", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    assert.equal(
      isReservedClientExpired("https://accounts.betterseqta.org/auth/bsplus/callback", past),
      false,
    );
    assert.equal(isReservedClientExpired("desqta://auth/callback", past), false);
  });

  it("still expires unknown redirect URIs", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    assert.equal(isReservedClientExpired("https://evil.example/callback", past), true);
  });

  it("stores null expires_at for persistent URIs on reserve", () => {
    assert.equal(
      expiresAtForReservedClient("https://accounts.betterseqta.org/auth/bsplus/callback"),
      null,
    );
    assert.equal(expiresAtForReservedClient("desqta://auth/callback"), null);
    assert.notEqual(expiresAtForReservedClient("https://evil.example/callback"), null);
  });
});
