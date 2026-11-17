import { config } from "./config.js";
import { corsHeaders } from "./cors.js";

const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function forwardHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHop.has(lower)) return;
    out.set(key, value);
  });
  return out;
}

function mergeCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Proxy to Cloudflare worker origin; forwards Authorization / cookies as-is. */
export async function proxyToWorker(request: Request, url: URL): Promise<Response> {
  const target = new URL(url.pathname + url.search, config.workerUpstream);
  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders(request.headers),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  const res = await fetch(target.toString(), init);
  return mergeCors(res);
}

export async function workerFetch(
  pathAndQuery: string,
  init: { method: string; headers: Headers; body?: BodyInit | null },
): Promise<Response> {
  const target = new URL(pathAndQuery, config.workerUpstream);
  const res = await fetch(target.toString(), {
    method: init.method,
    headers: forwardHeaders(init.headers),
    body: init.body ?? undefined,
    redirect: "manual",
  });
  return res;
}