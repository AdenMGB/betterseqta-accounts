import { config, publicHost } from "./config.js";
import { corsHeaders } from "./cors.js";
import { healthResponse, isHealthPath } from "./health.js";

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

function applyForwardHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHop.has(lower)) return;
    out.set(key, value);
  });
  out.set("X-Forwarded-Host", publicHost());
  out.set("X-Forwarded-Proto", "https");
  return out;
}

function rewriteLocation(location: string): string {
  const workerOrigin = config.workerUpstream;
  const publicOrigin = config.publicOrigin;
  if (location.startsWith(workerOrigin)) {
    return `${publicOrigin}${location.slice(workerOrigin.length)}`;
  }
  try {
    const url = new URL(location);
    if (url.origin === new URL(workerOrigin).origin) {
      return `${publicOrigin}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    /* relative */
  }
  return location;
}

function mergeProxyResponse(res: Response): Response {
  const headers = new Headers(res.headers);
  const location = headers.get("Location");
  if (location) headers.set("Location", rewriteLocation(location));
  for (const [k, v] of Object.entries(corsHeaders)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Proxy HTML, API, assets, and everything else to the Cloudflare Worker origin. */
export async function proxyToWorker(request: Request, url: URL): Promise<Response> {
  if (isHealthPath(url.pathname) && (request.method === "GET" || request.method === "HEAD")) {
    return healthResponse(request.method);
  }
  const target = new URL(url.pathname + url.search, config.workerUpstream);
  const init: RequestInit = {
    method: request.method,
    headers: applyForwardHeaders(request.headers),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  const res = await fetch(target.toString(), init);
  return mergeProxyResponse(res);
}

export async function workerFetch(
  pathAndQuery: string,
  init: { method: string; headers: Headers; body?: BodyInit | null },
): Promise<Response> {
  const target = new URL(pathAndQuery, config.workerUpstream);
  const res = await fetch(target.toString(), {
    method: init.method,
    headers: applyForwardHeaders(init.headers),
    body: init.body ?? undefined,
    redirect: "manual",
  });
  return res;
}