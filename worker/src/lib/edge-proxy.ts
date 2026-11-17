import { corsHeaders } from "../constants";

const EDGE_PATHS: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/api/health" },
  { method: "GET", path: "/api/bsplus/settings/sync" },
  { method: "PUT", path: "/api/bsplus/settings/sync" },
  { method: "GET", path: "/api/bsplus/timetable-classmates/peers" },
];

export function shouldProxyToEdge(request: Request, edgeBaseUrl: string | undefined): boolean {
  const base = edgeBaseUrl?.trim();
  if (!base) return false;
  const url = new URL(request.url);
  return EDGE_PATHS.some((r) => r.method === request.method && r.path === url.pathname);
}

export async function proxyRequestToEdge(request: Request, edgeBaseUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, edgeBaseUrl.replace(/\/$/, "/"));

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const res = await fetch(target.toString(), init);
  const outHeaders = new Headers(res.headers);
  if (!outHeaders.has("Access-Control-Allow-Origin")) {
    outHeaders.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
}