const BSPLUS_CALLBACK_PATH = "/auth/bsplus/callback";
const CHROME_EXTENSION_CALLBACK_PATH = "/auth/callback";

function normalizeAppBase(appUrl?: string): string {
  return (appUrl || "https://accounts.betterseqta.org").replace(/\/$/, "");
}

/** Allowed: desqta://… custom app scheme only (e.g. desqta://auth/callback). */
export function isValidDesqtaRedirectUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  if (!trimmed.startsWith("desqta://")) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "desqta:") return false;
    return Boolean(parsed.host || parsed.pathname.replace(/^\//, ""));
  } catch {
    return false;
  }
}

/** Allowed: accounts.betterseqta.org callback, chrome-extension://…/auth/callback, bsplus://… */
export function isValidBsplusRedirectUri(uri: string, appUrl?: string): boolean {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  const base = normalizeAppBase(appUrl);
  if (trimmed === `${base}${BSPLUS_CALLBACK_PATH}`) return true;

  if (trimmed.startsWith("chrome-extension://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "chrome-extension:") return false;
      return parsed.pathname === CHROME_EXTENSION_CALLBACK_PATH || parsed.pathname.endsWith(CHROME_EXTENSION_CALLBACK_PATH);
    } catch {
      return false;
    }
  }

  if (trimmed.startsWith("bsplus://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "bsplus:") return false;
      return Boolean(parsed.host || parsed.pathname.replace(/^\//, ""));
    } catch {
      return false;
    }
  }

  return false;
}

export function desqtaRedirectUriError(): string {
  return "redirect_uri must use the desqta:// custom scheme (e.g. desqta://auth/callback)";
}

export function bsplusRedirectUriError(): string {
  return "redirect_uri must be bsplus://, https://accounts.betterseqta.org/auth/bsplus/callback, or chrome-extension://<id>/auth/callback";
}

/** Reserved clients with known app redirect URIs do not expire. */
export function isPersistentReservedRedirectUri(uri: string, appUrl?: string): boolean {
  return isValidDesqtaRedirectUri(uri) || isValidBsplusRedirectUri(uri, appUrl);
}
