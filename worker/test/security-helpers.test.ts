import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeHtml } from "../src/lib/html-escape.ts";
import { isValidDesqtaRedirectUri, isValidBsplusRedirectUri } from "../src/lib/redirect-uri.ts";

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
