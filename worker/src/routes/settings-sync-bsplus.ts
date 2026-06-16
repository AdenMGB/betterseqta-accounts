import { BSPLUS_SYNC_MAX_BYTES, BSPLUS_SYNC_SCHEMA_VERSION, corsHeaders } from "../constants";
import { authError, getUser } from "../lib/auth";
import { stableStringify } from "../lib/json-stable";
import { loadAndPersistHydratedBsplus, mergeBsplusPatch } from "../lib/settings-store";
import type { RequestContext } from "../types/context";

export async function handleBsplusSettingsSync({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const bsSyncJsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
  const bsUser = await getUser(request, jwtSecret);
  if (!bsUser) {
    return authError("Unauthorized", 401, bsSyncJsonHeaders);
  }
  const bsUserId = bsUser.id;

  if (request.method === "GET") {
    const loaded = await loadAndPersistHydratedBsplus(env.DB, bsUserId);
    if (!loaded.rowExists) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: bsSyncJsonHeaders });
    }
    return new Response(
      JSON.stringify({
        schemaVersion: loaded.schemaVersion,
        data: loaded.hydrated,
        updated_at: loaded.updatedAt,
      }),
      { headers: bsSyncJsonHeaders },
    );
  }

  if (request.method === "PUT") {
    let body: { schemaVersion?: unknown; data?: unknown; themeId?: unknown };
    try {
      body = (await request.json()) as { schemaVersion?: unknown; data?: unknown; themeId?: unknown };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: bsSyncJsonHeaders });
    }
    const sv = body?.schemaVersion;
    const dataPayload = body?.data;
    if (typeof sv !== "number" || !Number.isFinite(sv) || Math.floor(sv) !== sv) {
      return new Response(JSON.stringify({ error: "schemaVersion must be an integer" }), {
        status: 422,
        headers: bsSyncJsonHeaders,
      });
    }
    if (sv !== BSPLUS_SYNC_SCHEMA_VERSION) {
      return new Response(JSON.stringify({ error: "Unsupported schemaVersion" }), {
        status: 422,
        headers: bsSyncJsonHeaders,
      });
    }
    if (dataPayload === null || typeof dataPayload !== "object" || Array.isArray(dataPayload)) {
      return new Response(JSON.stringify({ error: "data must be a plain object" }), {
        status: 422,
        headers: bsSyncJsonHeaders,
      });
    }

    const incomingData = dataPayload as Record<string, unknown>;
    const themeId = typeof body.themeId === "string" ? body.themeId.trim() : undefined;

    const loaded = await loadAndPersistHydratedBsplus(env.DB, bsUserId);
    const { merged, effectivePatch, changed } = mergeBsplusPatch(loaded.hydrated, incomingData, themeId);

    const mergedStr = JSON.stringify(merged);
    if (mergedStr.length > BSPLUS_SYNC_MAX_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: bsSyncJsonHeaders });
    }

    if (!changed && loaded.rowExists) {
      return new Response(
        JSON.stringify({
          updated_at: loaded.updatedAt,
          patch: effectivePatch,
        }),
        { status: 200, headers: bsSyncJsonHeaders },
      );
    }

    const existingCanonical = loaded.rowExists ? stableStringify(loaded.hydrated) : null;
    const mergedCanonical = stableStringify(merged);
    if (existingCanonical === mergedCanonical && loaded.rowExists) {
      return new Response(
        JSON.stringify({
          updated_at: loaded.updatedAt,
          patch: effectivePatch,
        }),
        { status: 200, headers: bsSyncJsonHeaders },
      );
    }

    const updatedAt = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO bsplus_settings_sync (user_id, schema_version, data, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET
                   schema_version = excluded.schema_version,
                   data = excluded.data,
                   updated_at = excluded.updated_at`,
    )
      .bind(bsUserId, sv, mergedStr, updatedAt)
      .run();

    return new Response(
      JSON.stringify({ updated_at: updatedAt, patch: effectivePatch }),
      { status: 200, headers: bsSyncJsonHeaders },
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: bsSyncJsonHeaders });
}
