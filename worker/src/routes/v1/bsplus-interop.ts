import { corsHeaders } from "../../constants";
import {
  verifyApiKey,
  apiKeyUnauthorized,
  apiKeyDbError,
  apiKeyHasScope,
  apiKeyForbiddenScope,
} from "../../lib/auth";
import { checkRateLimit } from "../../lib/rate-limit";
import { searchInteropInstallLinks, searchInteropUsers } from "../../lib/interopBsplusSearch";
import type { RequestContext } from "../../types/context";

const INTEROP_SCOPE = "bsplus:interop";

async function requireInteropKey(env: RequestContext["env"], request: Request) {
  const apiKey = await verifyApiKey(env, request);
  if (!apiKey) return apiKeyUnauthorized();
  if (!apiKeyHasScope(apiKey, INTEROP_SCOPE)) return apiKeyForbiddenScope(INTEROP_SCOPE);
  return apiKey;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleV1BsplusInteropUserSearch({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "v1-bsplus-interop", { limit: 240, windowSec: 3600 });
    if (rateLimited) return rateLimited;

    const auth = await requireInteropKey(env, request);
    if (auth instanceof Response) return auth;

    const q = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);

    const data = await searchInteropUsers(env.DB, { q, page, pageSize });
    return jsonResponse({ success: true, data });
  } catch (e) {
    return apiKeyDbError(e);
  }
}

export async function handleV1BsplusInteropInstallSearch({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "v1-bsplus-interop", { limit: 240, windowSec: 3600 });
    if (rateLimited) return rateLimited;

    const auth = await requireInteropKey(env, request);
    if (auth instanceof Response) return auth;

    const q = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const cloudUserId = url.searchParams.get("cloudUserId") || url.searchParams.get("userId") || null;

    const data = await searchInteropInstallLinks(env.DB, { q, page, pageSize, cloudUserId });
    return jsonResponse({ success: true, data });
  } catch (e) {
    return apiKeyDbError(e);
  }
}
