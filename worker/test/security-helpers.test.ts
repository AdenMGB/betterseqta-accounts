import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeHtml } from "../src/lib/html-escape.ts";
import {
  isValidDesqtaRedirectUri,
  isValidBsplusRedirectUri,
  isPersistentReservedRedirectUri,
  DESQTA_CANONICAL_REDIRECT_URI,
  BSPLUS_NATIVE_CANONICAL_REDIRECT_URI,
} from "../src/lib/redirect-uri.ts";
import { isReservedClientExpired, expiresAtForReservedClient } from "../src/lib/desqta-client.ts";
import { isSafeInternalPath } from "../src/lib/safe-internal-path.ts";
import { userRequiresEmailVerification } from "../src/lib/email-verification.ts";

const SAMPLE_EXT_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const bsplusOpts = {
  appUrl: "https://accounts.betterseqta.org",
  allowedChromeExtensionIds: [SAMPLE_EXT_ID],
};

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    assert.equal(escapeHtml(`Hello <script>alert("x")</script>`), "Hello &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("escapes ampersands and quotes", () => {
    assert.equal(escapeHtml(`Tom & Jerry's "cafe"`), "Tom &amp; Jerry&#39;s &quot;cafe&quot;");
  });
});

describe("redirect-uri allowlist", () => {
  it("accepts canonical desqta redirect only", () => {
    assert.equal(isValidDesqtaRedirectUri(DESQTA_CANONICAL_REDIRECT_URI), true);
    assert.equal(isValidDesqtaRedirectUri("desqta://evil/callback"), false);
  });

  it("rejects http and https redirect URIs for desqta", () => {
    assert.equal(isValidDesqtaRedirectUri("https://evil.example/callback"), false);
    assert.equal(isValidDesqtaRedirectUri("http://evil.example/callback"), false);
  });

  it("accepts documented bsplus redirect patterns when allowlisted", () => {
    assert.equal(
      isValidBsplusRedirectUri("https://accounts.betterseqta.org/auth/bsplus/callback", bsplusOpts),
      true,
    );
    assert.equal(isValidBsplusRedirectUri(`chrome-extension://${SAMPLE_EXT_ID}/auth/callback`, bsplusOpts), true);
    assert.equal(isValidBsplusRedirectUri(BSPLUS_NATIVE_CANONICAL_REDIRECT_URI, bsplusOpts), true);
  });

  it("rejects arbitrary https URIs and unlisted extension IDs", () => {
    assert.equal(isValidBsplusRedirectUri("https://evil.example/steal", bsplusOpts), false);
    assert.equal(isValidBsplusRedirectUri("chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/auth/callback", bsplusOpts), false);
    assert.equal(isValidBsplusRedirectUri(`chrome-extension://${SAMPLE_EXT_ID}/auth/callback`), false);
  });
});

describe("persistent reserved clients", () => {
  it("treats known BS+ and DesQTA redirect URIs as non-expiring", () => {
    assert.equal(isPersistentReservedRedirectUri(DESQTA_CANONICAL_REDIRECT_URI), true);
    assert.equal(
      isPersistentReservedRedirectUri("https://accounts.betterseqta.org/auth/bsplus/callback", bsplusOpts),
      true,
    );
    assert.equal(
      isPersistentReservedRedirectUri(`chrome-extension://${SAMPLE_EXT_ID}/auth/callback`, bsplusOpts),
      true,
    );
    assert.equal(isPersistentReservedRedirectUri("https://evil.example/callback", bsplusOpts), false);
  });

  it("never reports expiry for persistent redirect URIs", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    assert.equal(
      isReservedClientExpired("https://accounts.betterseqta.org/auth/bsplus/callback", past, undefined, bsplusOpts),
      false,
    );
    assert.equal(isReservedClientExpired(DESQTA_CANONICAL_REDIRECT_URI, past), false);
  });

  it("still expires unknown redirect URIs", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    assert.equal(isReservedClientExpired("https://evil.example/callback", past, undefined, bsplusOpts), true);
  });

  it("stores null expires_at for persistent URIs on reserve", () => {
    assert.equal(
      expiresAtForReservedClient("https://accounts.betterseqta.org/auth/bsplus/callback", undefined, bsplusOpts),
      null,
    );
    assert.equal(expiresAtForReservedClient(DESQTA_CANONICAL_REDIRECT_URI), null);
    assert.notEqual(expiresAtForReservedClient("https://evil.example/callback", undefined, bsplusOpts), null);
  });
});

describe("isSafeInternalPath", () => {
  it("rejects open redirects", () => {
    assert.equal(isSafeInternalPath("//evil.com"), false);
    assert.equal(isSafeInternalPath("https://evil.com"), false);
  });

  it("allows in-app paths except auth pages", () => {
    assert.equal(isSafeInternalPath("/oauth/authorize"), true);
    assert.equal(isSafeInternalPath("/login"), false);
  });
});

describe("userRequiresEmailVerification", () => {
  it("skips discord placeholder emails", () => {
    assert.equal(userRequiresEmailVerification({ email: "discord_1@discord.local", email_verified_at: null }), false);
  });

  it("requires verification when timestamp missing", () => {
    assert.equal(userRequiresEmailVerification({ email: "a@b.com", email_verified_at: null }), true);
    assert.equal(userRequiresEmailVerification({ email: "a@b.com", email_verified_at: 1 }), false);
  });
});