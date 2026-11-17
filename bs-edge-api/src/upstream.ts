import { config, publicHost } from "./config.js";
import { corsHeadersForRequest } from "./cors.js";
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
  "accept-encoding",
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
  // Never ask Worker for br/gzip — Node may not decode consistently before we re-serve.
  out.set("Accept-Encoding", "identity");
  return out;
}

function isRewriteableTextContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return (
    ct.includes("text/") ||
    ct.includes("application/json") ||
    ct.includes("+json") ||
    ct.includes("application/javascript") ||
    ct.includes("text/javascript") ||
    ct.includes("application/xml") ||
    ct.includes("image/svg+xml")
  );
}

export function rewritePublicUrlsInText(text: string): string {
  const workerOrigin = new URL(config.workerUpstream).origin;
  const publicOrigin = config.publicOrigin;
  if (workerOrigin === publicOrigin) return text;
  return text.split(workerOrigin).join(publicOrigin);
}

function rewriteLocation(location: string): string {
  return rewritePublicUrlsInText(location);
}

function stripEncodedLengthHeaders(headers: Headers): void {
  // Node `fetch` decompresses upstream bodies; keeping Content-Encoding: br breaks browsers.
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
}

async function mergeProxyResponse(request: Request, res: Response): Promise<Response> {
  const headers = new Headers(res.headers);
  stripEncodedLengthHeaders(headers);
  const location = headers.get("Location");
  if (location) headers.set("Location", rewriteLocation(location));

  // Replace edge CORS (reflect Origin) — avoids duplicate/conflicting worker headers.
  for (const key of [
    "access-control-allow-origin",
    "access-control-allow-credentials",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "access-control-max-age",
    "vary",
  ]) {
    headers.delete(key);
  }
  for (const [k, v] of Object.entries(corsHeadersForRequest(request))) {
    headers.set(k, v);
  }

  const contentType = headers.get("Content-Type") ?? "";

  if (res.status === 204 || res.status === 304) {
    return new Response(null, { status: res.status, statusText: res.statusText, headers });
  }

  const bytes = await res.arrayBuffer();
  if (isRewriteableTextContentType(contentType)) {
    const text = new TextDecoder("utf-8").decode(bytes);
    const body = rewritePublicUrlsInText(text);
    return new Response(body, { status: res.status, statusText: res.statusText, headers });
  }

  return new Response(bytes, { status: res.status, statusText: res.statusText, headers });
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
  return mergeProxyResponse(request, res);
}

export async function workerFetch(
  pathAndQuery: string,
  init: { method: string; headers: Headers; body?: BodyInit | null },
  clientRequest?: Request,
): Promise<Response> {
  const target = new URL(pathAndQuery, config.workerUpstream);
  const res = await fetch(target.toString(), {
    method: init.method,
    headers: applyForwardHeaders(init.headers),
    body: init.body ?? undefined,
    redirect: "manual",
  });
  if (clientRequest) {
    return mergeProxyResponse(clientRequest, res);
  }
  return res;
}