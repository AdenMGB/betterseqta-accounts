import { corsHeaders } from "../constants";
import { authError, authJson, getUser } from "../lib/auth";
import {
  installRowToApi,
  isoNow,
  parseInstallId,
  parseInstallLinkBody,
  type BsplusInstallRow,
} from "../lib/bsplus-installs";
import type { RequestContext } from "../types/context";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function successEnvelope<T>(data: T) {
  return { success: true, data };
}

export async function handleBsplusInstallLink({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return authError("Unauthorized", 401, jsonHeaders);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
  }

  const parsed = parseInstallLinkBody(body);
  if ("error" in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 422, headers: jsonHeaders });
  }

  const { installId, extension, deviceName, lastSeenAt } = parsed;
  const now = isoNow();
  const extensionJson = JSON.stringify(extension);

  const existing = await env.DB.prepare(
    "SELECT install_id FROM bsplus_install_link WHERE install_id = ?",
  )
    .bind(installId)
    .first<{ install_id: string }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE bsplus_install_link
       SET cloud_user_id = ?, device_name = ?, extension_json = ?, last_seen_at = ?, updated_at = ?
       WHERE install_id = ?`,
    )
      .bind(user.id, deviceName, extensionJson, lastSeenAt, now, installId)
      .run();
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
  }

  await env.DB.prepare(
    `INSERT INTO bsplus_install_link
       (install_id, cloud_user_id, device_name, extension_json, last_seen_at, linked_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(installId, user.id, deviceName, extensionJson, lastSeenAt, now, now)
    .run();

  return new Response(JSON.stringify({ success: true }), { status: 201, headers: jsonHeaders });
}

export async function handleBsplusInstallsList({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return authError("Unauthorized", 401, jsonHeaders);

  const { results } = await env.DB.prepare(
    `SELECT install_id, cloud_user_id, device_name, extension_json, last_seen_at, linked_at, updated_at
     FROM bsplus_install_link
     WHERE cloud_user_id = ?
     ORDER BY last_seen_at DESC, linked_at DESC`,
  )
    .bind(user.id)
    .all<BsplusInstallRow>();

  const installs = (results ?? []).map(installRowToApi);
  return authJson(successEnvelope({ installs }));
}

export async function handleBsplusInstallDelete({
  env,
  request,
  url,
  jwtSecret,
}: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return authError("Unauthorized", 401, jsonHeaders);

  const segments = url.pathname.split("/").filter(Boolean);
  const installIdRaw = segments[segments.length - 1];
  const installId = parseInstallId(installIdRaw);
  if (!installId) {
    return new Response(JSON.stringify({ error: "Invalid install id" }), { status: 400, headers: jsonHeaders });
  }

  const row = await env.DB.prepare(
    "SELECT install_id FROM bsplus_install_link WHERE install_id = ? AND cloud_user_id = ?",
  )
    .bind(installId, user.id)
    .first();

  if (!row) {
    return new Response(JSON.stringify({ error: "Install not found" }), { status: 404, headers: jsonHeaders });
  }

  await env.DB.prepare("DELETE FROM bsplus_install_link WHERE install_id = ? AND cloud_user_id = ?")
    .bind(installId, user.id)
    .run();

  return authJson({ success: true }, jsonHeaders);
}
