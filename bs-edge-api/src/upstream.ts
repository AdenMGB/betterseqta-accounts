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

function workerRequestHost(): string {
  return new URL(config.workerUpstream).host;
}

function applyForwardHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHop.has(lower)) return;
    out.set(key, value);
  });
  out.set("Host", workerRequestHost());
  out.set("X-Forwarded-Host", publicHost());
  out.set("X-Forwarded-Proto", "https");
  // Never ask Worker for br/gzip — Node may not decode consistently before we re-serve.
  out.set("Accept-Encoding", "identity");
  return out;
}

/** API/OAuth responses must not be 3xx to clients (ofetch redirect loops on same host). */
function mustResolveRedirectsForClient(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/oauth/");
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

function samePathOnAccountsHost(location: string, pathAndQuery: string, publicOrigin: string, workerOrigin: string): boolean {
  try {
    const loc = new URL(location);
  const want = new URL(pathAndQuery, config.workerUpstream);
    return (
      (loc.origin === publicOrigin || loc.origin === workerOrigin) &&
      loc.pathname === want.pathname &&
      loc.search === want.search
    );
  } catch {
    return false;
  }
}

async function fetchWorkerUpstream(
  clientRequest: Request,
  pathAndQuery: string,
  init: { method: string; headers: Headers; body?: BodyInit | null | undefined },
): Promise<Response> {
  const workerOrigin = new URL(config.workerUpstream).origin;
  const publicOrigin = new URL(config.publicOrigin).origin;
  const resolveRedirects = mustResolveRedirectsForClient(new URL(pathAndQuery, config.publicOrigin).pathname);
  let target = new URL(pathAndQuery, config.workerUpstream);
  const headers = applyForwardHeaders(init.headers);
  const method = init.method;
  const body = method === "GET" || method === "HEAD" ? undefined : init.body ?? undefined;
  const startedOnWorker = target.toString();

  for (let hop = 0; hop < 16; hop++) {
    const res = await fetch(target.toString(), {
      method,
      headers,
      body: hop === 0 ? body : undefined,
      redirect: "manual",
    });
    if (res.status < 300 || res.status >= 400) {
      return mergeProxyResponse(clientRequest, res);
    }
    const location = res.headers.get("Location");
    if (!location) {
      if (resolveRedirects) {
        return new Response(JSON.stringify({ error: "upstream_redirect_missing_location" }), {
          status: 502,
          headers: { ...corsHeadersForRequest(clientRequest), "Content-Type": "application/json" },
        });
      }
      return mergeProxyResponse(clientRequest, res);
    }
    if (samePathOnAccountsHost(location, pathAndQuery, publicOrigin, workerOrigin)) {
      target = new URL(pathAndQuery, workerOrigin);
      continue;
    }
    const next = new URL(location, target);
    if (next.origin === publicOrigin || next.origin === workerOrigin) {
      target = new URL(next.pathname + next.search, workerOrigin);
      continue;
    }
    if (resolveRedirects) {
      return new Response(
        JSON.stringify({ error: "upstream_redirect_external", location }),
        {
          status: 502,
          headers: { ...corsHeadersForRequest(clientRequest), "Content-Type": "application/json" },
        },
      );
    }
    return mergeProxyResponse(clientRequest, res);
  }

  console.error("[upstream] redirect loop", method, pathAndQuery, startedOnWorker);
  return new Response(JSON.stringify({ error: "upstream_redirect_loop" }), {
    status: 502,
    headers: { ...corsHeadersForRequest(clientRequest), "Content-Type": "application/json" },
  });
}

/** Proxy HTML, API, assets, and everything else to the Cloudflare Worker origin. */
export async function proxyToWorker(request: Request, url: URL): Promise<Response> {
  if (isHealthPath(url.pathname) && (request.method === "GET" || request.method === "HEAD")) {
    return healthResponse(request.method);
  }
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  return fetchWorkerUpstream(request, url.pathname + url.search, {
    method: request.method,
    headers: request.headers,
    body,
  });
}

export async function workerFetch(
  pathAndQuery: string,
  init: { method: string; headers: Headers; body?: BodyInit | null },
  clientRequest?: Request,
): Promise<Response> {
  if (clientRequest) {
    return fetchWorkerUpstream(clientRequest, pathAndQuery, init);
  }
  const res = await fetch(new URL(pathAndQuery, config.workerUpstream).toString(), {
    method: init.method,
    headers: applyForwardHeaders(init.headers),
    body: init.body ?? undefined,
    redirect: "manual",
  });
  return res;
}