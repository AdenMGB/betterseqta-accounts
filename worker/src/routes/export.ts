import { corsHeaders } from "../constants";
import { verifyApiKey, apiKeyUnauthorized, apiKeyDbError } from "../lib/auth";
import type { RequestContext } from "../types/context";

export async function handleExportUsersCount({ env, request }: RequestContext): Promise<Response> {
  try {
    const apiKey = await verifyApiKey(env, request);
    if (!apiKey) return apiKeyUnauthorized();
    const totalResult = await env.DB.prepare("SELECT COUNT(*) as total FROM users").first();
    return new Response(JSON.stringify({ total: (totalResult?.total as number) ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleExportReservedClients({ env, request }: RequestContext): Promise<Response> {
  try {
    const apiKey = await verifyApiKey(env, request);
    if (!apiKey) return apiKeyUnauthorized();
    const result = await env.DB.prepare("SELECT COUNT(*) as count FROM desqta_reserved_clients").first();
    return new Response(JSON.stringify({ count: (result?.count as number) ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleExportUsersFull({ env, request }: RequestContext): Promise<Response> {
  try {
    const apiKey = await verifyApiKey(env, request);
    if (!apiKey) return apiKeyUnauthorized();
    let rows: Record<string, unknown>[];
    try {
      const r = await env.DB.prepare("SELECT * FROM users ORDER BY createdAt ASC").all();
      rows = (r.results ?? []) as Record<string, unknown>[];
    } catch {
      try {
        const r = await env.DB.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
        rows = (r.results ?? []) as Record<string, unknown>[];
      } catch {
        const r = await env.DB.prepare("SELECT * FROM users ORDER BY id ASC").all();
        rows = (r.results ?? []) as Record<string, unknown>[];
      }
    }
    const users = rows.map(({ password: _p, ...rest }) => rest);
    return new Response(JSON.stringify({ users, count: users.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleExportUsersContact({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const apiKey = await verifyApiKey(env, request);
    if (!apiKey) return apiKeyUnauthorized();

    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const limitParam = parseInt(url.searchParams.get("limit") || "1000", 10);
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const limit = Math.min(5000, Math.max(1, isNaN(limitParam) ? 1000 : limitParam));
    const offset = (page - 1) * limit;

    let rows: { email?: string; displayName?: string }[];
    let totalResult: { total?: number } | undefined;
    try {
      totalResult = (await env.DB.prepare("SELECT COUNT(*) as total FROM users").first()) as { total?: number };
      const r = await env.DB.prepare(
        "SELECT email, displayName FROM users ORDER BY created_at ASC LIMIT ? OFFSET ?",
      )
        .bind(limit, offset)
        .all();
      rows = (r.results ?? []) as { email?: string; displayName?: string }[];
    } catch {
      try {
        const r = await env.DB.prepare(
          "SELECT email, displayName FROM users ORDER BY createdAt ASC LIMIT ? OFFSET ?",
        )
          .bind(limit, offset)
          .all();
        rows = (r.results ?? []) as { email?: string; displayName?: string }[];
      } catch {
        const r = await env.DB.prepare("SELECT email, displayName FROM users ORDER BY id ASC LIMIT ? OFFSET ?")
          .bind(limit, offset)
          .all();
        rows = (r.results ?? []) as { email?: string; displayName?: string }[];
      }
    }

    const total = totalResult?.total ?? rows.length;
    const totalPages = Math.ceil(total / limit);

    return new Response(
      JSON.stringify({
        users: rows,
        count: rows.length,
        total,
        page,
        limit,
        totalPages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return apiKeyDbError(e);
  }
}
