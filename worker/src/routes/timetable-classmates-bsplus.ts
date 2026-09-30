import { corsHeaders } from "../constants";
import { authError, authJson, getUser, type JwtUserPayload } from "../lib/auth";
import { checkRateLimitKeyed } from "../lib/rate-limit";
import {
  computeIdentityBindingDigest,
  isoNow,
  normalizeInstanceHost,
  parseAttestedAt,
  parseIdentityBindingDigest,
  parseIdentityBindingVersion,
  parseSeqtaAccountType,
  parseSeqtaPersonUuid,
  parseSeqtaStudentId,
  shareCodeFromIdentityDigest,
  bytesToBase64,
} from "../lib/timetable-classmates";
import { createRelayToken, verifyRelayToken } from "../lib/timetable-classmates-relay-token";
import { relayRevokeStudentShare } from "../lib/timetable-classmates-relay-client";
import type { RequestContext } from "../types/context";
import type { Env } from "../types/env";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

async function requireBsplusUser(ctx: RequestContext): Promise<JwtUserPayload | null> {
  return getUser(ctx.request, ctx.jwtSecret);
}

async function rateLimitUser(env: Env, userId: string, bucket: string, limit: number, windowSec: number) {
  return checkRateLimitKeyed(env, `${bucket}:${userId}`, { limit, windowSec });
}

async function ensureInstance(env: Env, instanceHost: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO tq_instance (instance_host, updated_at) VALUES (?, ?) ON CONFLICT(instance_host) DO NOTHING",
  )
    .bind(instanceHost, isoNow())
    .run();
}

/** Same bundle key for every opted-in student on this SEQTA instance (required for peer decrypt). */
async function getOrCreateInstanceRelayBundleKey(env: Env, instanceHost: string): Promise<string> {
  await ensureInstance(env, instanceHost);
  const row = await env.DB.prepare(
    "SELECT relay_bundle_key_b64 FROM tq_instance WHERE instance_host = ?",
  )
    .bind(instanceHost)
    .first<{ relay_bundle_key_b64: string | null }>();

  const existing = row?.relay_bundle_key_b64?.trim();
  if (existing) return existing;

  const bundleBytes = new Uint8Array(32);
  crypto.getRandomValues(bundleBytes);
  const bundle_key_b64 = bytesToBase64(bundleBytes);
  await env.DB.prepare(
    "UPDATE tq_instance SET relay_bundle_key_b64 = ?, updated_at = ? WHERE instance_host = ?",
  )
    .bind(bundle_key_b64, isoNow(), instanceHost)
    .run();
  return bundle_key_b64;
}

async function getActiveMembership(env: Env, cloudUserId: string, instanceHost: string) {
  return env.DB.prepare(
    `SELECT id, seqta_student_id, cloud_user_id, seqta_person_uuid, opted_in_at, last_seen_at,
            identity_binding_digest, identity_binding_version
     FROM tq_membership
     WHERE cloud_user_id = ? AND instance_host = ? AND revoked_at IS NULL`,
  )
    .bind(cloudUserId, instanceHost)
    .first<{
      id: string;
      seqta_student_id: number;
      cloud_user_id: string;
      seqta_person_uuid: string;
      opted_in_at: string;
      last_seen_at: string;
      identity_binding_digest: string | null;
      identity_binding_version: number | null;
    }>();
}

type VerifiedBinding = { digest: string; version: 1 };

async function verifyIdentityBinding(
  payload: Record<string, unknown>,
  cloudUserId: string,
  instanceHost: string,
  seqtaStudentId: number,
  seqtaPersonUuid: string,
  options: { checkAttestedAt: boolean },
): Promise<VerifiedBinding | Response> {
  const digest = parseIdentityBindingDigest(payload.identity_binding_digest);
  const version = parseIdentityBindingVersion(payload.identity_binding_version);
  const seqtaAccountType = parseSeqtaAccountType(payload.seqta_account_type);
  if (seqtaAccountType === null) {
    return authError("Invalid seqta_account_type", 422);
  }
  if (!digest || version === null) {
    return authError("Invalid identity binding", 422);
  }
  if (options.checkAttestedAt && !parseAttestedAt(payload.attested_at)) {
    return authError("Invalid or skewed attested_at", 422);
  }

  const expected = await computeIdentityBindingDigest({
    version,
    instanceHost,
    seqtaStudentId,
    seqtaPersonUuid,
    cloudUserId,
    seqtaAccountType,
  });
  if (digest !== expected) {
    return authError("Identity binding digest mismatch", 422);
  }
  return { digest, version };
}

function seqtaIdentityChanged(
  membership: { seqta_student_id: number; seqta_person_uuid: string },
  seqtaStudentId: number,
  seqtaPersonUuid: string,
): boolean {
  return (
    membership.seqta_student_id !== seqtaStudentId ||
    membership.seqta_person_uuid.toLowerCase() !== seqtaPersonUuid
  );
}

function instanceHostFromQuery(url: URL): string | null {
  return normalizeInstanceHost(url.searchParams.get("instance_host") ?? "");
}

function relayWsUrl(env: Env, requestOrigin: string): string {
  const base = (env.APP_URL?.trim() || requestOrigin).replace(/\/$/, "");
  return `${base.replace(/^http/, "ws")}/api/bsplus/timetable-classmates/relay/ws`;
}

export async function handleTimetableClassmatesOptInPut(ctx: RequestContext): Promise<Response> {
  const user = await requireBsplusUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "tq-opt-in", 10, 3600);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await ctx.request.json();
  } catch {
    return authError("Invalid JSON body", 422);
  }
  const payload = body as Record<string, unknown>;
  const instanceHost = normalizeInstanceHost(payload.instance_host);
  const seqtaStudentId = parseSeqtaStudentId(payload.seqta_student_id);
  const seqtaPersonUuid = parseSeqtaPersonUuid(payload.seqta_person_uuid);
  if (!instanceHost || seqtaStudentId === null || !seqtaPersonUuid) {
    return authError("Invalid opt-in payload", 422);
  }

  const binding = await verifyIdentityBinding(payload, user.id, instanceHost, seqtaStudentId, seqtaPersonUuid, {
    checkAttestedAt: true,
  });
  if (binding instanceof Response) return binding;

  await ensureInstance(ctx.env, instanceHost);

  const conflict = await ctx.env.DB.prepare(
    `SELECT cloud_user_id FROM tq_membership
     WHERE instance_host = ? AND revoked_at IS NULL
       AND cloud_user_id != ?
       AND (seqta_student_id = ? OR seqta_person_uuid = ?)
     LIMIT 1`,
  )
    .bind(instanceHost, user.id, seqtaStudentId, seqtaPersonUuid)
    .first<{ cloud_user_id: string }>();

  if (conflict) {
    return authError("Another cloud account is already registered for this SEQTA identity on this school", 409);
  }

  const now = isoNow();
  const existingActive = await getActiveMembership(ctx.env, user.id, instanceHost);
  if (existingActive) {
    if (seqtaIdentityChanged(existingActive, seqtaStudentId, seqtaPersonUuid)) {
      return authError("SEQTA identity changed for this cloud account; opt out and register again", 409);
    }
    await ctx.env.DB.prepare(
      `UPDATE tq_membership
       SET seqta_student_id = ?, seqta_person_uuid = ?, last_seen_at = ?,
           identity_binding_digest = ?, identity_binding_version = ?
       WHERE id = ?`,
    )
      .bind(
        seqtaStudentId,
        seqtaPersonUuid,
        now,
        binding.digest,
        binding.version,
        existingActive.id,
      )
      .run();
    return authJson({ opted_in_at: existingActive.opted_in_at }, jsonHeaders);
  }

  const revokedRow = await ctx.env.DB.prepare(
    `SELECT id FROM tq_membership
     WHERE cloud_user_id = ? AND instance_host = ? AND revoked_at IS NOT NULL
     ORDER BY opted_in_at DESC LIMIT 1`,
  )
    .bind(user.id, instanceHost)
    .first<{ id: string }>();

  if (revokedRow) {
    await ctx.env.DB.prepare(
      `UPDATE tq_membership
       SET seqta_student_id = ?, seqta_person_uuid = ?, opted_in_at = ?, revoked_at = NULL, last_seen_at = ?,
           identity_binding_digest = ?, identity_binding_version = ?
       WHERE id = ?`,
    )
      .bind(seqtaStudentId, seqtaPersonUuid, now, now, binding.digest, binding.version, revokedRow.id)
      .run();
    return authJson({ opted_in_at: now }, jsonHeaders);
  }

  const id = crypto.randomUUID();
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO tq_membership
       (id, cloud_user_id, instance_host, seqta_student_id, seqta_person_uuid, opted_in_at, revoked_at, last_seen_at,
        identity_binding_digest, identity_binding_version)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    )
      .bind(
        id,
        user.id,
        instanceHost,
        seqtaStudentId,
        seqtaPersonUuid,
        now,
        now,
        binding.digest,
        binding.version,
      )
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(msg)) {
      return authError("Another cloud account is already registered for this SEQTA identity on this school", 409);
    }
    throw err;
  }

  return authJson({ opted_in_at: now }, jsonHeaders);
}

export async function handleTimetableClassmatesOptInDelete(ctx: RequestContext): Promise<Response> {
  const user = await requireBsplusUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "tq-opt-in", 10, 3600);
  if (limited) return limited;

  const instanceHost = instanceHostFromQuery(ctx.url);
  if (!instanceHost) {
    return authError("Invalid instance_host", 422);
  }

  const membership = await getActiveMembership(ctx.env, user.id, instanceHost);
  const now = isoNow();
  const result = await ctx.env.DB.prepare(
    `UPDATE tq_membership SET revoked_at = ? WHERE cloud_user_id = ? AND instance_host = ? AND revoked_at IS NULL`,
  )
    .bind(now, user.id, instanceHost)
    .run();

  if (membership && (result.meta.changes ?? 0) > 0) {
    await relayRevokeStudentShare(ctx.env, instanceHost, membership.seqta_student_id);
  }

  if ((result.meta.changes ?? 0) === 0) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return authJson({ ok: true }, jsonHeaders);
}

export async function handleTimetableClassmatesPeers(ctx: RequestContext): Promise<Response> {
  const user = await requireBsplusUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "tq-peers", 60, 3600);
  if (limited) return limited;

  const instanceHost = instanceHostFromQuery(ctx.url);
  if (!instanceHost) {
    return authError("Invalid instance_host", 422);
  }

  const self = await getActiveMembership(ctx.env, user.id, instanceHost);
  if (!self) {
    return authError("Not registered on this school instance", 404);
  }

  const { results } = await ctx.env.DB.prepare(
    `SELECT seqta_student_id, cloud_user_id
     FROM tq_membership
     WHERE instance_host = ? AND revoked_at IS NULL AND cloud_user_id != ?
     ORDER BY seqta_student_id ASC`,
  )
    .bind(instanceHost, user.id)
    .all<{ seqta_student_id: number; cloud_user_id: string }>();

  const peers = (results ?? []).map((row) => {
    const entry: { seqta_student_id: number; cloud_user_id?: string } = { seqta_student_id: row.seqta_student_id };
    if (row.cloud_user_id) entry.cloud_user_id = row.cloud_user_id;
    return entry;
  });

  return authJson(
    {
      self: {
        seqta_student_id: self.seqta_student_id,
        cloud_user_id: self.cloud_user_id,
      },
      peers,
    },
    jsonHeaders,
  );
}

export async function handleTimetableClassmatesHeartbeat(ctx: RequestContext): Promise<Response> {
  const user = await requireBsplusUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "tq-heartbeat", 120, 86400);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await ctx.request.json();
  } catch {
    return authError("Invalid JSON body", 422);
  }
  const payload = body as Record<string, unknown>;
  const instanceHost = normalizeInstanceHost(payload.instance_host);
  const seqtaStudentId = parseSeqtaStudentId(payload.seqta_student_id);
  const seqtaPersonUuid = parseSeqtaPersonUuid(payload.seqta_person_uuid);
  if (!instanceHost || seqtaStudentId === null || !seqtaPersonUuid) {
    return authError("Invalid heartbeat payload", 422);
  }

  const binding = await verifyIdentityBinding(payload, user.id, instanceHost, seqtaStudentId, seqtaPersonUuid, {
    checkAttestedAt: false,
  });
  if (binding instanceof Response) return binding;

  const membership = await getActiveMembership(ctx.env, user.id, instanceHost);
  if (!membership) {
    return authError("Not registered on this school instance", 404);
  }

  if (seqtaIdentityChanged(membership, seqtaStudentId, seqtaPersonUuid)) {
    return authError("SEQTA identity changed for this cloud account; opt out and register again", 409);
  }

  if (
    membership.identity_binding_digest &&
    membership.identity_binding_digest.toLowerCase() !== binding.digest
  ) {
    return authError("Identity binding digest mismatch", 422);
  }

  const now = isoNow();
  await ctx.env.DB.prepare(
    `UPDATE tq_membership
     SET last_seen_at = ?, identity_binding_digest = ?, identity_binding_version = ?
     WHERE id = ?`,
  )
    .bind(now, binding.digest, binding.version, membership.id)
    .run();

  return authJson({ ok: true }, jsonHeaders);
}

export async function handleTimetableClassmatesRelaySession(ctx: RequestContext): Promise<Response> {
  const user = await requireBsplusUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "tq-relay-session", 120, 3600);
  if (limited) return limited;

  const instanceHost = instanceHostFromQuery(ctx.url);
  if (!instanceHost) {
    return authError("Invalid instance_host", 422);
  }

  const membership = await getActiveMembership(ctx.env, user.id, instanceHost);
  if (!membership) {
    return authError("Not registered on this school instance", 404);
  }

  const share_code = shareCodeFromIdentityDigest(membership.identity_binding_digest);
  if (!share_code) {
    return authError("Identity binding required for relay session", 422);
  }

  const bundle_key_b64 = await getOrCreateInstanceRelayBundleKey(ctx.env, instanceHost);

  const relay_token = await createRelayToken(
    {
      typ: "tq_relay",
      instance_host: instanceHost,
      cloud_user_id: user.id,
      seqta_student_id: membership.seqta_student_id,
      share_code,
    },
    ctx.jwtSecret,
  );

  return authJson(
    {
      ws_url: relayWsUrl(ctx.env, ctx.url.origin),
      relay_token,
      bundle_key_b64,
      share_code,
      relay_protocol: 1,
    },
    jsonHeaders,
  );
}

export async function handleTimetableClassmatesRelayWs(ctx: RequestContext): Promise<Response> {
  if (ctx.request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426, headers: corsHeaders });
  }

  const instanceHost = instanceHostFromQuery(ctx.url);
  const relayToken = ctx.url.searchParams.get("relay_token")?.trim();
  if (!instanceHost || !relayToken) {
    return authError("Invalid relay connection", 422);
  }

  const claims = await verifyRelayToken(relayToken, ctx.jwtSecret);
  if (!claims || claims.instance_host !== instanceHost) {
    return authError("Invalid relay token", 401);
  }

  const membership = await getActiveMembership(ctx.env, claims.cloud_user_id, instanceHost);
  if (!membership) {
    return authError("Not registered on this school instance", 404);
  }

  if (membership.seqta_student_id !== claims.seqta_student_id) {
    return authError("Relay token does not match membership", 401);
  }

  const expectedShare = shareCodeFromIdentityDigest(membership.identity_binding_digest);
  if (!expectedShare || expectedShare !== claims.share_code) {
    return authError("Invalid relay token", 401);
  }

  const ns = ctx.env.TIMETABLE_CLASSMATES_RELAY;
  if (!ns) {
    return authError("Relay not configured", 503);
  }

  const id = ns.idFromName(instanceHost);
  const stub = ns.get(id);

  const headers = new Headers(ctx.request.headers);
  headers.set("X-TQ-Cloud-User-Id", claims.cloud_user_id);
  headers.set("X-TQ-Seqta-Student-Id", String(claims.seqta_student_id));
  headers.set("X-TQ-Share-Code", claims.share_code);

  return stub.fetch(new Request(ctx.request, { headers }));
}
