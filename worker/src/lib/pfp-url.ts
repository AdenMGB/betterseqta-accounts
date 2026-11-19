import type { Env } from "../types/env";
import { buildUserPfpUrl, getAppBaseUrl, userPfpPath } from "./pfpHistory";

const MIGRATION_FETCH_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
  "discordapp.com",
]);

function hostFromAppUrl(appUrl: string): string | null {
  try {
    return new URL(appUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** User profile update: only clear or point at this user's hosted accounts pfp URL. */
export function validateUserPfpUrlForUpdate(
  env: Pick<Env, "APP_URL">,
  userId: string,
  pfpUrl: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (pfpUrl === null || pfpUrl === undefined) return { ok: true, value: null };
  if (typeof pfpUrl !== "string") return { ok: false, error: "Invalid pfpUrl" };
  const trimmed = pfpUrl.trim();
  if (!trimmed) return { ok: true, value: null };

  const canonical = buildUserPfpUrl(env, userId);
  const relative = userPfpPath(userId);
  if (trimmed === canonical || trimmed === relative) return { ok: true, value: canonical };

  return { ok: false, error: "pfpUrl must be your BetterSEQTA+ hosted profile image URL" };
}

function blockedFetchHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.endsWith(".internal") ||
    h === "metadata.google.internal"
  ) {
    return true;
  }
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "169.254.169.254") return true;
  return false;
}

/** Admin migration may only download from known avatar CDNs or this accounts host. */
export function isPfpUrlAllowedForAdminMigration(pfpUrl: string, env: Pick<Env, "APP_URL">): boolean {
  if (!pfpUrl?.trim()) return false;
  const trimmed = pfpUrl.trim();
  if (trimmed.startsWith("/api/user/pfp/")) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (blockedFetchHostname(parsed.hostname)) return false;

  const appHost = hostFromAppUrl(getAppBaseUrl(env));
  if (appHost && parsed.hostname.toLowerCase() === appHost) {
    return parsed.pathname.startsWith("/api/user/pfp/");
  }

  return MIGRATION_FETCH_HOSTS.has(parsed.hostname.toLowerCase());
}