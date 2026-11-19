import type { Env } from "../types/env";

const BSPLUS_CALLBACK_PATH = "/auth/bsplus/callback";
const CHROME_EXTENSION_CALLBACK_PATH = "/auth/callback";
export const DESQTA_CANONICAL_REDIRECT_URI = "desqta://auth/callback";
export const BSPLUS_NATIVE_CANONICAL_REDIRECT_URI = "bsplus://auth/callback";

/** Chrome extension IDs are 32 chars from a–p (lowercase). */
const CHROME_EXTENSION_ID_RE = /^[a-p]{32}$/;

export type RedirectUriOptions = {
  appUrl?: string;
  /** Lowercase extension IDs permitted to use chrome-extension://…/auth/callback */
  allowedChromeExtensionIds?: string[];
};

function normalizeAppBase(appUrl?: string): string {
  return (appUrl || "https://accounts.betterseqta.org").replace(/\/$/, "");
}

export function parseAllowedChromeExtensionIds(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((id) => CHROME_EXTENSION_ID_RE.test(id));
}

function allowedChromeExtensionId(options: RedirectUriOptions | undefined, extensionId: string): boolean {
  const allow = new Set((options?.allowedChromeExtensionIds ?? []).map((id) => id.toLowerCase()));
  if (allow.size === 0) return false;
  return allow.has(extensionId.toLowerCase());
}

/** Allowed: exact desqta://auth/callback only. */
export function isValidDesqtaRedirectUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") return false;
  return uri.trim() === DESQTA_CANONICAL_REDIRECT_URI;
}

/** Allowed: accounts web callback, allowlisted chrome-extension IDs, or bsplus://auth/callback. */
export function isValidBsplusRedirectUri(uri: string, options?: RedirectUriOptions): boolean {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  const base = normalizeAppBase(options?.appUrl);
  if (trimmed === `${base}${BSPLUS_CALLBACK_PATH}`) return true;

  if (trimmed.startsWith("chrome-extension://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "chrome-extension:") return false;
      const extId = parsed.hostname.toLowerCase();
      if (!CHROME_EXTENSION_ID_RE.test(extId)) return false;
      if (
        parsed.pathname !== CHROME_EXTENSION_CALLBACK_PATH &&
        !parsed.pathname.endsWith(CHROME_EXTENSION_CALLBACK_PATH)
      ) {
        return false;
      }
      return allowedChromeExtensionId(options, extId);
    } catch {
      return false;
    }
  }

  return trimmed === BSPLUS_NATIVE_CANONICAL_REDIRECT_URI;
}

export function desqtaRedirectUriError(): string {
  return `redirect_uri must be exactly ${DESQTA_CANONICAL_REDIRECT_URI}`;
}

export function bsplusRedirectUriError(): string {
  return "redirect_uri must be bsplus://auth/callback, the accounts HTTPS callback, or chrome-extension://<allowlisted-id>/auth/callback";
}

/** Reserved clients with known app redirect URIs do not expire. */
export function isPersistentReservedRedirectUri(uri: string, options?: RedirectUriOptions): boolean {
  return isValidDesqtaRedirectUri(uri) || isValidBsplusRedirectUri(uri, options);
}

export function bsplusRedirectOptions(env: Pick<Env, "APP_URL" | "ALLOWED_CHROME_EXTENSION_IDS">): RedirectUriOptions {
  return {
    appUrl: env.APP_URL,
    allowedChromeExtensionIds: parseAllowedChromeExtensionIds(env.ALLOWED_CHROME_EXTENSION_IDS),
  };
}