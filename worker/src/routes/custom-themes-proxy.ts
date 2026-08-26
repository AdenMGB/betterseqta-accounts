import { corsHeaders } from "../constants";
import { extractAccessToken, getUser } from "../lib/auth";
import type { RequestContext } from "../types/context";

const DEFAULT_BSPLUS_WEB_URL = "https://betterseqta.org";

export async function handleCustomThemesProxy(ctx: RequestContext): Promise<Response> {
  const { request, url, env, jwtSecret } = ctx;
  const pathname = url.pathname;

  const token = extractAccessToken(request);
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: { message: "Unauthorized" } }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const user = await getUser(request, jwtSecret);
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: { message: "Unauthorized" } }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const baseUrl = (env.BSPLUS_WEB_URL || DEFAULT_BSPLUS_WEB_URL).replace(/\/$/, "");
  const targetUrl = `${baseUrl}${pathname}${url.search}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const contentType = request.headers.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? request.body : undefined,
    });

    const responseHeaders = new Headers(corsHeaders);
    const upstreamContentType = upstream.headers.get("Content-Type");
    if (upstreamContentType) {
      responseHeaders.set("Content-Type", upstreamContentType);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Custom themes proxy error:", err);
    return new Response(JSON.stringify({ success: false, error: { message: "Upstream request failed" } }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
