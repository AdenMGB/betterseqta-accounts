import { corsHeaders } from "./cors.js";

/** Served only on bs-edge-api — must not hit the Worker (saves billable invocations). */
export function healthResponse(method: string): Response {
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Served-By": "bs-edge-api",
  };
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(JSON.stringify({ ok: true, service: "accounts" }), { status: 200, headers });
}

export function isHealthPath(pathname: string): boolean {
  return pathname === "/api/health" || pathname === "/health";
}