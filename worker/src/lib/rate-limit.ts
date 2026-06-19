import { corsHeaders } from "../constants";
import { getRequestIp } from "./cookies";
import type { Env } from "../types/env";

export type RateLimitConfig = {
  limit: number;
  windowSec: number;
};

export async function checkRateLimit(
  env: Env,
  request: Request,
  bucket: string,
  config: RateLimitConfig,
): Promise<Response | null> {
  const ip = getRequestIp(request) || "unknown";
  const bucketKey = `${bucket}:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const existing = await env.DB.prepare(
      "SELECT count, window_start FROM rate_limit_buckets WHERE bucket_key = ?",
    )
      .bind(bucketKey)
      .first();

    if (!existing) {
      await env.DB.prepare(
        "INSERT INTO rate_limit_buckets (bucket_key, count, window_start) VALUES (?, 1, ?)",
      )
        .bind(bucketKey, now)
        .run();
      return null;
    }

    const windowStart = existing.window_start as number;
    const count = existing.count as number;
    const windowElapsed = now - windowStart;

    if (windowElapsed >= config.windowSec) {
      await env.DB.prepare(
        "UPDATE rate_limit_buckets SET count = 1, window_start = ? WHERE bucket_key = ?",
      )
        .bind(now, bucketKey)
        .run();
      return null;
    }

    if (count >= config.limit) {
      const retryAfter = config.windowSec - windowElapsed;
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, retryAfter)),
        },
      });
    }

    await env.DB.prepare("UPDATE rate_limit_buckets SET count = count + 1 WHERE bucket_key = ?")
      .bind(bucketKey)
      .run();
    return null;
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return null;
  }
}
