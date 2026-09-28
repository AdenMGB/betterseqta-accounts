import { corsHeaders } from "../constants";
import { authError, extractAccessToken, getUser } from "../lib/auth";
import { getBsplusBaseUrl } from "../lib/env-util";
import type { RequestContext } from "../types/context";

export async function handleCustomThemesProxy({ request, url, env, jwtSecret }: RequestContext): Promise<Response> {
  if (!(await getUser(request, jwtSecret))) return authError("Unauthorized");

  const headers = new Headers({ Authorization: `Bearer ${extractAccessToken(request)}` });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const upstream = await fetch(`${getBsplusBaseUrl(env)}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
  } catch (err) {
    console.error("Custom themes proxy error:", err);
    return authError("Upstream request failed", 502);
  }
}
