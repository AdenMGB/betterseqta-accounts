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
): boolean {
  if (!requested || !registered) return false;
  return requested.trim() === registered.trim() && isSafeOAuthRedirectUri(requested);
}

export function buildOAuthAccessDeniedUrl(registeredRedirectUri: string): string | null {
  if (!isSafeOAuthRedirectUri(registeredRedirectUri)) return null;
  const url = new URL(registeredRedirectUri.trim());
  url.searchParams.set("error", "access_denied");
  return url.toString();
}