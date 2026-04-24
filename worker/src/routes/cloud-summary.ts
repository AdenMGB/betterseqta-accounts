import { corsHeaders } from "../constants";
import { authError, getUser } from "../lib/auth";
import type { RequestContext } from "../types/context";

export async function handleCloudSummary({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const summaryHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
  const su = await getUser(request, jwtSecret);
  if (!su) {
    return authError("Unauthorized", 401, summaryHeaders);
  }
  const summaryUserId = su.id;

  const settingsRow = await env.DB.prepare("SELECT user_id FROM settings WHERE user_id = ?").bind(summaryUserId).first();
  let desqta: { updated_at: string | null; revision: number } | null = null;
  if (settingsRow) {
    const meta = await env.DB.prepare("SELECT settings_revision, settings_updated_at FROM settings_metadata WHERE user_id = ?")
      .bind(summaryUserId)
      .first();
    desqta = {
      updated_at: (meta?.settings_updated_at as string) ?? null,
      revision: (meta?.settings_revision as number) ?? 1,
    };
  }

  const bsRow = await env.DB.prepare("SELECT schema_version, updated_at FROM bsplus_settings_sync WHERE user_id = ?")
    .bind(summaryUserId)
    .first();
  const bsplus = bsRow
    ? { updated_at: bsRow.updated_at as string, schemaVersion: bsRow.schema_version as number }
    : null;

  return new Response(JSON.stringify({ desqta, bsplus }), { headers: summaryHeaders });
}
