import { corsHeaders } from "../constants";
import {
  verifyApiKey,
  apiKeyUnauthorized,
  apiKeyDbError,
  apiKeyHasRequiredScope,
  apiKeyForbiddenScope,
  type ApiKeyAuth,
} from "../lib/auth";
import { checkRateLimit } from "../lib/rate-limit";
import { USER_PUBLIC_SELECT } from "../lib/userPublic";
import type { RequestContext } from "../types/context";

export const EXPORT_SCOPE_USERS_COUNT = "export:users:count";
export const EXPORT_SCOPE_USERS_FULL = "export:users:full";
export const EXPORT_SCOPE_USERS_CONTACT = "export:users:contact";
export const EXPORT_SCOPE_RESERVED_CLIENTS = "export:reserved-clients";

async function exportRateLimit(env: RequestContext["env"], request: Request): Promise<Response | null> {
  return checkRateLimit(env, request, "export", { limit: 30, windowSec: 3600 });
}

async function requireExportScope(
  env: RequestContext["env"],
  request: Request,
  scope: string,
): Promise<ApiKeyAuth | Response> {
  const apiKey = await verifyApiKey(env, request);
  if (!apiKey) return apiKeyUnauthorized();
  if (!apiKeyHasRequiredScope(apiKey, scope)) return apiKeyForbiddenScope(scope);
  return apiKey;
}

export async function handleExportUsersCount({ env, request }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await exportRateLimit(env, request);
    if (rateLimited) return rateLimited;

    const apiKey = await requireExportScope(env, request, EXPORT_SCOPE_USERS_COUNT);
    if (apiKey instanceof Response) return apiKey;
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
    const rateLimited = await exportRateLimit(env, request);
    if (rateLimited) return rateLimited;

    const apiKey = await requireExportScope(env, request, EXPORT_SCOPE_RESERVED_CLIENTS);
    if (apiKey instanceof Response) return apiKey;
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
    const rateLimited = await exportRateLimit(env, request);
    if (rateLimited) return rateLimited;

    const apiKey = await requireExportScope(env, request, EXPORT_SCOPE_USERS_FULL);
    if (apiKey instanceof Response) return apiKey;
    let rows: Record<string, unknown>[];
    const selectUsersPublic = `SELECT ${USER_PUBLIC_SELECT} FROM users`;
    try {
      const r = await env.DB.prepare(`${selectUsersPublic} ORDER BY createdAt ASC`).all();
      rows = (r.results ?? []) as Record<string, unknown>[];
    } catch {
      try {
        const r = await env.DB.prepare(`${selectUsersPublic} ORDER BY created_at ASC`).all();
        rows = (r.results ?? []) as Record<string, unknown>[];
      } catch {
        const r = await env.DB.prepare(`${selectUsersPublic} ORDER BY id ASC`).all();
        rows = (r.results ?? []) as Record<string, unknown>[];
      }
    }
    const users = rows;
    return new Response(JSON.stringify({ users, count: users.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleExportUsersContact({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await exportRateLimit(env, request);
    if (rateLimited) return rateLimited;

    const apiKey = await requireExportScope(env, request, EXPORT_SCOPE_USERS_CONTACT);
    if (apiKey instanceof Response) return apiKey;

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
