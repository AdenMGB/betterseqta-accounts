import { createHash } from "node:crypto";

/** Stable cache/queue key from forwarded client credentials (no JWT parsing). */
export function authKeyFromRequest(req: Request): string {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  const cookie = req.headers.get("Cookie")?.trim() ?? "";
  if (!auth && !cookie) return "anonymous";
  return createHash("sha256").update(`${auth}\n${cookie}`).digest("hex").slice(0, 32);
}