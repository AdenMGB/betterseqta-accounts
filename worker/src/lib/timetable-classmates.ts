import { sha256HexUtf8 } from "./sha256";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IDENTITY_DIGEST_RE = /^[0-9a-f]{64}$/;
const ATTESTED_AT_SKEW_MS = 15 * 60 * 1000;

export type IdentityBindingInput = {
  version: number;
  instanceHost: string;
  seqtaStudentId: number;
  seqtaPersonUuid: string;
  cloudUserId: string;
  seqtaAccountType?: string | null;
};

export function buildIdentityBindingCanonical(input: IdentityBindingInput): string {
  const lines = [
    `v=${input.version}`,
    `instance=${input.instanceHost}`,
    `student=${input.seqtaStudentId}`,
    `person=${input.seqtaPersonUuid}`,
    `cloud=${input.cloudUserId.toLowerCase()}`,
  ];
  if (input.seqtaAccountType != null && input.seqtaAccountType !== "") {
    lines.push(`type=${input.seqtaAccountType}`);
  }
  return lines.join("\n");
}

export async function computeIdentityBindingDigest(input: IdentityBindingInput): Promise<string> {
  return sha256HexUtf8(buildIdentityBindingCanonical(input));
}

export function parseIdentityBindingDigest(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!IDENTITY_DIGEST_RE.test(trimmed)) return null;
  return trimmed;
}

export function parseIdentityBindingVersion(raw: unknown): number | null {
  if (raw !== 1 && raw !== "1") return null;
  return 1;
}

export function parseSeqtaAccountType(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 64) return null;
  return trimmed;
}

export function parseAttestedAt(raw: unknown, now: Date = new Date()): boolean {
  if (raw === undefined || raw === null) return true;
  if (typeof raw !== "string") return false;
  const parsed = Date.parse(raw.trim());
  if (!Number.isFinite(parsed)) return false;
  return Math.abs(now.getTime() - parsed) <= ATTESTED_AT_SKEW_MS;
}

export function normalizeInstanceHost(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const host = raw.trim().toLowerCase();
  if (!host || host.length > 253) return null;
  if (host.includes("://") || host.includes("/") || host.includes("?") || host.includes("#")) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return null;
  return host;
}

export function parseSeqtaStudentId(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) return null;
  return raw;
}

export function parseSeqtaPersonUuid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** First 8 hex chars of identity_binding_digest (relay dedupe / debug). */
export function shareCodeFromIdentityDigest(digest: string | null | undefined): string | null {
  const d = (digest ?? "").trim().toLowerCase();
  if (d.length < 8 || !/^[0-9a-f]+$/.test(d.slice(0, 8))) return null;
  return d.slice(0, 8);
}
