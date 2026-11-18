import { d1First } from "./d1-client.js";

export function normalizeInstanceHost(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const host = raw.trim().toLowerCase();
  if (!host || host.length > 253) return null;
  if (host.includes("://") || host.includes("/") || host.includes("?") || host.includes("#")) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return null;
  return host;
}

export function shareCodeFromIdentityDigest(digest: string | null | undefined): string | null {
  const d = (digest ?? "").trim().toLowerCase();
  if (d.length < 8 || !/^[0-9a-f]+$/.test(d.slice(0, 8))) return null;
  return d.slice(0, 8);
}

type MembershipRow = {
  seqta_student_id: number;
  identity_binding_digest: string | null;
};

export async function getActiveMembership(cloudUserId: string, instanceHost: string): Promise<MembershipRow | null> {
  return d1First<MembershipRow>(
    `SELECT seqta_student_id, identity_binding_digest
     FROM tq_membership
     WHERE cloud_user_id = ? AND instance_host = ? AND revoked_at IS NULL`,
    cloudUserId,
    instanceHost,
  );
}