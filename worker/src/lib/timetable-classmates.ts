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

/** ISO week label `YYYY-Www` in UTC (matches BetterSEQTA+ extension). */
export function currentUtcIsoWeek(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
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

export function newThreadSubject(publishWeek: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `BQ+TIMETABLE:v1:WEEK:${publishWeek}:${hex}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

const COORDINATOR_STALE_MS = 14 * 24 * 60 * 60 * 1000;

export type MembershipRow = {
  cloud_user_id: string;
  last_seen_at: string;
  opted_in_at: string;
};

export type InstanceRow = {
  publish_week: string | null;
  thread_subject: string | null;
  coordinator_cloud_user_id: string | null;
};

export type SyncHintPlan = {
  publishWeek: string;
  threadSubject: string;
  coordinatorCloudUserId: string | null;
  shouldPublish: boolean;
};

/** Pure coordinator decision (week rotation vs mid-week stale coordinator). */
export function planSyncHint(
  instance: InstanceRow,
  activeMembers: MembershipRow[],
  callerCloudUserId: string,
  now: Date = new Date(),
): SyncHintPlan {
  const publishWeek = currentUtcIsoWeek(now);
  const weekChanged = instance.publish_week !== publishWeek;

  let threadSubject = instance.thread_subject;
  let coordinatorId = instance.coordinator_cloud_user_id;

  const coordinatorMember = coordinatorId
    ? activeMembers.find((m) => m.cloud_user_id === coordinatorId)
    : undefined;
  const coordinatorLastSeen = coordinatorMember?.last_seen_at
    ? Date.parse(coordinatorMember.last_seen_at)
    : NaN;
  const coordinatorStale =
    !coordinatorMember ||
    !Number.isFinite(coordinatorLastSeen) ||
    now.getTime() - coordinatorLastSeen > COORDINATOR_STALE_MS;

  const needsNewCoordinator = weekChanged || coordinatorStale || !coordinatorId;

  if (needsNewCoordinator && activeMembers.length > 0) {
    const sorted = [...activeMembers].sort((a, b) => {
      const seenDiff = Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at);
      if (seenDiff !== 0) return seenDiff;
      return Date.parse(a.opted_in_at) - Date.parse(b.opted_in_at);
    });
    coordinatorId = sorted[0]?.cloud_user_id ?? null;
  }

  if (weekChanged) {
    threadSubject = coordinatorId ? newThreadSubject(publishWeek) : null;
  } else if (!threadSubject && coordinatorId) {
    threadSubject = newThreadSubject(publishWeek);
  }

  const effectiveWeek = weekChanged ? publishWeek : (instance.publish_week ?? publishWeek);
  const shouldPublish =
    Boolean(coordinatorId) && callerCloudUserId === coordinatorId && publishWeek === effectiveWeek;

  return {
    publishWeek,
    threadSubject: threadSubject ?? "",
    coordinatorCloudUserId: coordinatorId,
    shouldPublish,
  };
}
