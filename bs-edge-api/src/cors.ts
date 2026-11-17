/** CORS for browser + Chrome extension clients (BS+). */
const ALLOWED_METHODS = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
const ALLOWED_HEADERS =
  "Content-Type, Authorization, X-User-ID, X-API-Key, Cookie, Accept, Range, X-Requested-With";

const baseCors: Record<string, string> = {
  "Access-Control-Allow-Methods": ALLOWED_METHODS,
  "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  "Access-Control-Max-Age": "86400",
};

/** Legacy static headers (`*` origin). */
export const corsHeaders: Record<string, string> = {
  ...baseCors,
  "Access-Control-Allow-Origin": "*",
};

/**
 * Reflect `Origin` when present (required for `credentials: 'include'` and many extension fetches).
 * Otherwise fall back to `*`.
 */
export function corsHeadersForRequest(request: Request | null): Record<string, string> {
  const origin = request?.headers.get("Origin")?.trim();
  if (origin) {
    return {
      ...baseCors,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    };
  }
  return corsHeaders;
}