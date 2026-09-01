import { corsHeaders } from "../../constants";
import {
  verifyApiKey,
  apiKeyUnauthorized,
  apiKeyDbError,
  apiKeyHasScope,
  apiKeyForbiddenScope,
} from "../../lib/auth";
import { checkRateLimit } from "../../lib/rate-limit";
import { isFounding2500, getUserBadges, displayUserBadges, FOUNDING_2500_THRESHOLD } from "../../lib/badges";
import { mapUserPublic, USER_PUBLIC_SELECT, enrichUserPublic } from "../../lib/userPublic";
import type { RequestContext } from "../../types/context";

async function requireScopedApiKey(
  env: RequestContext["env"],
  request: Request,
  scope: string,
): Promise<{ id: string; scopes: string[] } | Response> {
  const apiKey = await verifyApiKey(env, request);
  if (!apiKey) return apiKeyUnauthorized();
  if (!apiKeyHasScope(apiKey, scope)) return apiKeyForbiddenScope(scope);
  return apiKey;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractPathParam(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match?.[1] ?? null;
}

export async function handleV1UserProfile({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "v1-users", { limit: 120, windowSec: 3600 });
    if (rateLimited) return rateLimited;

    const auth = await requireScopedApiKey(env, request, "users:read");
    if (auth instanceof Response) return auth;

    const userId = extractPathParam(url.pathname, /^\/api\/v1\/users\/([^/]+)\/profile$/);
    if (!userId) return jsonResponse({ error: "Invalid user id" }, 400);

    const row = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT}, signup_number FROM users WHERE id = ?`)
      .bind(userId)
      .first();
    if (!row) return jsonResponse({ error: "User not found" }, 404);

    const enriched = await enrichUserPublic(env.DB, mapUserPublic(row as Record<string, unknown>));
    if (!enriched) return jsonResponse({ error: "User not found" }, 404);

    return jsonResponse({
      id: enriched.id,
      username: enriched.username,
      displayName: enriched.displayName,
      pfpUrl: enriched.pfpUrl,
      signup_number: enriched.signup_number ?? null,
      badges: enriched.badges ?? [],
      is_founding_2500: enriched.is_founding_2500 ?? false,
    });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleV1UserFounding2500Eligibility({
  env,
  request,
  url,
}: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "v1-users", { limit: 120, windowSec: 3600 });
    if (rateLimited) return rateLimited;

    const auth = await requireScopedApiKey(env, request, "users:read");
    if (auth instanceof Response) return auth;

    const userId = extractPathParam(url.pathname, /^\/api\/v1\/users\/([^/]+)\/eligibility\/founding-2500$/);
    if (!userId) return jsonResponse({ error: "Invalid user id" }, 400);

    const row = await env.DB.prepare("SELECT signup_number FROM users WHERE id = ?").bind(userId).first();
    if (!row) return jsonResponse({ error: "User not found" }, 404);

    const signupNumber = (row.signup_number as number | null) ?? null;
    return jsonResponse({
      eligible: isFounding2500(signupNumber),
      signup_number: signupNumber,
      threshold: FOUNDING_2500_THRESHOLD,
    });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleV1UserBadges({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "v1-users", { limit: 120, windowSec: 3600 });
    if (rateLimited) return rateLimited;

    const auth = await requireScopedApiKey(env, request, "badges:read");
    if (auth instanceof Response) return auth;

    const userId = extractPathParam(url.pathname, /^\/api\/v1\/users\/badges\/([^/]+)$/);
    if (!userId) return jsonResponse({ error: "Invalid user id" }, 400);

    const userRow = await env.DB.prepare("SELECT id, signup_number FROM users WHERE id = ?")
      .bind(userId)
      .first<{ id: string; signup_number: number | null }>();
    if (!userRow) return jsonResponse({ error: "User not found" }, 404);

    const badges = displayUserBadges(
      await getUserBadges(env.DB, userId),
      userRow.signup_number ?? null,
    );
    return jsonResponse({ userId, badges });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleExportUsersSignupOrder({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "export", { limit: 30, windowSec: 3600 });
    if (rateLimited) return rateLimited;

    const auth = await requireScopedApiKey(env, request, "export:signup-order");
    if (auth instanceof Response) return auth;

    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const limitParam = parseInt(url.searchParams.get("limit") || "1000", 10);
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const limit = Math.min(5000, Math.max(1, isNaN(limitParam) ? 1000 : limitParam));
    const offset = (page - 1) * limit;

    let rows: Record<string, unknown>[];
    let total = 0;
    try {
      const totalResult = await env.DB.prepare("SELECT COUNT(*) as total FROM users").first();
      total = (totalResult?.total as number) ?? 0;
      const result = await env.DB.prepare(
        `SELECT id, email, displayName, username, signup_number, created_at
         FROM users
         ORDER BY CASE WHEN signup_number IS NULL THEN 1 ELSE 0 END, signup_number ASC, created_at ASC, id ASC
         LIMIT ? OFFSET ?`,
      )
        .bind(limit, offset)
        .all();
      rows = (result.results ?? []) as Record<string, unknown>[];
    } catch {
      try {
        const totalResult = await env.DB.prepare("SELECT COUNT(*) as total FROM users").first();
        total = (totalResult?.total as number) ?? 0;
        const result = await env.DB.prepare(
          `SELECT id, email, displayName, username, signup_number
           FROM users
           ORDER BY signup_number ASC, id ASC
           LIMIT ? OFFSET ?`,
        )
          .bind(limit, offset)
          .all();
        rows = (result.results ?? []) as Record<string, unknown>[];
      } catch {
        return apiKeyDbError(new Error("Failed to query signup order"));
      }
    }

    const users = rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      username: row.username,
      signup_number: row.signup_number ?? null,
      created_at: row.created_at ?? null,
    }));

    return jsonResponse({
      users,
      count: users.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    return apiKeyDbError(e);
  }
}
