import { corsHeaders } from "../constants";
import { verifyApiKey, apiKeyUnauthorized, apiKeyDbError } from "../lib/auth";
import type { RequestContext } from "../types/context";

export async function handleStatsDiscord({ env, request }: RequestContext): Promise<Response> {
  try {
    const apiKey = await verifyApiKey(env, request);
    if (!apiKey) return apiKeyUnauthorized();
    const totalResult = await env.DB.prepare("SELECT COUNT(*) as total FROM users").first();
    let lastDay = 0;
    try {
      const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
      const lastDayResult = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= ?")
        .bind(oneDayAgo)
        .first();
      lastDay = (lastDayResult?.count as number) ?? 0;
    } catch {
      // created_at column may not exist on older schemas
    }
    return new Response(
      JSON.stringify({
        total: (totalResult?.total as number) ?? 0,
        lastDay,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return apiKeyDbError(e);
  }
}
