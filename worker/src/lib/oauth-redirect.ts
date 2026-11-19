import type { Env } from "../types/env";
import { bsplusRedirectOptions, isValidBsplusRedirectUri } from "./redirect-uri";

const BSPLUS_ACCOUNTS_PATH = "/auth/bsplus/callback";
const BSPLUS_WEBSITE_CALLBACK_PATH = "/api/auth/callback";

function normalizeAppBaseLocal(appUrl?: string): string {
  return (appUrl || "https://accounts.betterseqta.org").replace(/\/$/, "");
}

/** HTTPS (or local http) accounts-hosted BS+ OAuth callback page. */
export function isAccountsBsplusHttpsCallback(uri: string, appUrl?: string): boolean {
  try {
    const parsed = new URL(uri.trim());
    const path = parsed.pathname.replace(/\/$/, "") || "/";
    if (path !== BSPLUS_ACCOUNTS_PATH) return false;

    const baseHost = new URL(normalizeAppBaseLocal(appUrl)).hostname.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = new Set([baseHost, "accounts.betterseqta.org", "localhost", "127.0.0.1"]);
    if (!allowedHosts.has(host)) return false;

    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && (host === "localhost" || host === "127.0.0.1");
  } catch {
    return false;
  }
}

/** betterseqta.org (or local dev) SPA OAuth callback used by the public site. */
export function isBetterseqtaWebsiteBsplusCallback(uri: string): boolean {
  try {
    const parsed = new URL(uri.trim());
    const path = parsed.pathname.replace(/\/$/, "") || "/";
    if (path !== BSPLUS_WEBSITE_CALLBACK_PATH) return false;
    const host = parsed.hostname.toLowerCase();
    const allowed = new Set(["betterseqta.org", "www.betterseqta.org", "localhost", "127.0.0.1"]);
    if (!allowed.has(host)) return false;
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && (host === "localhost" || host === "127.0.0.1");
  } catch {
    return false;
  }
}

/**
 * Whether the authorize request redirect_uri is allowed for a client's registered URI.
 * Handles prod vs localhost accounts callbacks and extension clients used with the web callback.
 */
export function oauthRedirectUrisEquivalent(
  requested: string | undefined,
  registered: string | undefined | null,
  env?: Pick<Env, "APP_URL" | "ALLOWED_CHROME_EXTENSION_IDS" | "ALLOWED_MOZ_EXTENSION_IDS">,
): boolean {
  if (!requested || !registered) return false;
  const req = requested.trim();
  const reg = registered.trim();
  if (req === reg) return true;

  const appUrl = env?.APP_URL;
  if (isAccountsBsplusHttpsCallback(req, appUrl) && isAccountsBsplusHttpsCallback(reg, appUrl)) {
    return true;
  }

  const opts = env ? bsplusRedirectOptions(env) : undefined;
  if (isAccountsBsplusHttpsCallback(req, appUrl) && isValidBsplusRedirectUri(reg, opts)) {
    return true;
  }

  // Extension browser login uses accounts callback; admin OAuth client may register the website callback.
  if (isAccountsBsplusHttpsCallback(req, appUrl) && isBetterseqtaWebsiteBsplusCallback(reg)) {
    return true;
  }
  if (isBetterseqtaWebsiteBsplusCallback(req) && isAccountsBsplusHttpsCallback(reg, appUrl)) {
    return true;
  }

  return false;
}

/** Safe redirect targets for OAuth deny/cancel (blocks javascript:, data:, etc.). */
export function isSafeOAuthRedirectUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return true;
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return true;
    }
    if (parsed.protocol === "chrome-extension:") {
      return parsed.pathname === "/auth/callback" || parsed.pathname.endsWith("/auth/callback");
    }
    if (parsed.protocol === "moz-extension:") {
      return parsed.pathname === "/auth/callback" || parsed.pathname.endsWith("/auth/callback");
    }
    if (parsed.protocol === "desqta:" || parsed.protocol === "bsplus:") {
      return Boolean(parsed.host || parsed.pathname.replace(/^\//, ""));
    }
    return false;
  } catch {
    return false;
  }
}

export function registeredOAuthRedirectMatches(
  requested: string | undefined,
  registered: string | null | undefined,
  env?: Pick<Env, "APP_URL" | "ALLOWED_CHROME_EXTENSION_IDS" | "ALLOWED_MOZ_EXTENSION_IDS">,
): boolean {
  if (!requested || !registered) return false;
  if (!isSafeOAuthRedirectUri(requested)) return false;
  return oauthRedirectUrisEquivalent(requested, registered, env);
}

export function buildOAuthAccessDeniedUrl(registeredRedirectUri: string): string | null {
  if (!isSafeOAuthRedirectUri(registeredRedirectUri)) return null;
  const url = new URL(registeredRedirectUri.trim());
  url.searchParams.set("error", "access_denied");
  return url.toString();
}