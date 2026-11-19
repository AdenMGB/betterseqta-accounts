const BLOCKED_PATHS = new Set(["/login", "/register", "/reset-password"]);

/** Relative in-app path only (open-redirect safe). */
export function isSafeInternalPath(path: string): boolean {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  const pathname = path.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  return !BLOCKED_PATHS.has(pathname);
}