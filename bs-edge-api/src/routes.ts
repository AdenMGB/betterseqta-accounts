import type { Context } from "hono";
import { config } from "./config.js";
import { authKeyFromRequest } from "./auth-key.js";
import { corsHeadersForRequest } from "./cors.js";
import { getRedis, redisKeys } from "./redis.js";
import { healthResponse, isHealthPath } from "./health.js";
import { proxyToWorker, rewritePublicUrlsInText, workerFetch } from "./upstream.js";

function jsonCorsHeaders(req: Request): Record<string, string> {
  return {
    ...corsHeadersForRequest(req),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

export function handleHealth(method = "GET"): Response {
  return healthResponse(method);
}

export async function handleSettingsSync(c: Context): Promise<Response> {
  const req = c.req.raw;
  const authKey = authKeyFromRequest(req);
  const redis = getRedis();

  if (req.method === "GET") {
    const cached = await redis.get(redisKeys.syncGetCache(authKey));
    if (cached) {
      return new Response(rewritePublicUrlsInText(cached), {
        status: 200,
        headers: jsonCorsHeaders(req),
      });
    }
    return workerFetch(
      "/api/bsplus/settings/sync",
      { method: "GET", headers: req.headers },
      req,
    );
  }

  if (req.method === "PUT") {
    const authProbe = await workerFetch(
      "/api/bsplus/settings/sync",
      { method: "GET", headers: req.headers },
      req,
    );
    if (authProbe.status === 401) {
      return authProbe;
    }

    const bodyText = await req.text();
    const pending = {
      authKey,
      bodyText,
      contentType: req.headers.get("Content-Type") ?? "application/json",
      authorization: req.headers.get("Authorization") ?? "",
      cookie: req.headers.get("Cookie") ?? "",
      queuedAt: new Date().toISOString(),
    };
    await redis.set(redisKeys.syncPending(authKey), JSON.stringify(pending));
    await redis.sadd(redisKeys.syncQueue, authKey);
    await redis.del(redisKeys.syncGetCache(authKey));

    let patch: unknown = {};
    try {
      const parsed = JSON.parse(bodyText) as { data?: unknown };
      if (parsed.data && typeof parsed.data === "object") patch = parsed.data;
    } catch {
      /* ignore */
    }

    return new Response(JSON.stringify({ updated_at: pending.queuedAt, patch }), {
      status: 200,
      headers: jsonCorsHeaders(req),
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: jsonCorsHeaders(req),
  });
}

export async function handlePeers(c: Context): Promise<Response> {
  const req = c.req.raw;
  const url = new URL(req.url);
  const instanceHost = url.searchParams.get("instance_host")?.trim() ?? "";
  const authKey = authKeyFromRequest(req);
  const redis = getRedis();
  const cacheKey = redisKeys.peersCache(authKey, instanceHost);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return new Response(rewritePublicUrlsInText(cached), {
      status: 200,
      headers: jsonCorsHeaders(req),
    });
  }

  const path = `/api/bsplus/timetable-classmates/peers${url.search}`;
  const res = await workerFetch(path, { method: "GET", headers: req.headers }, req);
  if (res.ok) {
    const text = await res.clone().text();
    await redis.setex(cacheKey, config.peersCacheTtlSec, text);
  }
  return res;
}

export async function handleProxy(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  if (isHealthPath(url.pathname) && (c.req.method === "GET" || c.req.method === "HEAD")) {
    return handleHealth(c.req.method);
  }
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersForRequest(c.req.raw) });
  }
  return proxyToWorker(c.req.raw, url);
}