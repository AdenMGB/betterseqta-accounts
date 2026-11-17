import { config } from "./config.js";
import { getRedis, redisKeys } from "./redis.js";
import { workerFetch } from "./upstream.js";

type PendingSync = {
  authKey: string;
  bodyText: string;
  contentType: string;
  authorization: string;
  cookie: string;
  queuedAt: string;
};

function clientHeaders(p: PendingSync): Headers {
  const h = new Headers({ "Content-Type": p.contentType || "application/json" });
  if (p.authorization) h.set("Authorization", p.authorization);
  if (p.cookie) h.set("Cookie", p.cookie);
  return h;
}

export async function flushPendingSyncs(): Promise<void> {
  const redis = getRedis();
  const batch = await redis.spop(redisKeys.syncQueue, 200);
  if (!batch?.length) return;

  const keys = batch.filter((k: string | null): k is string => typeof k === "string");
  for (const authKey of keys) {
    const raw = await redis.get(redisKeys.syncPending(authKey));
    if (!raw) continue;

    let pending: PendingSync;
    try {
      pending = JSON.parse(raw) as PendingSync;
    } catch {
      await redis.del(redisKeys.syncPending(authKey));
      continue;
    }

    const stillQueued = await redis.get(redisKeys.syncPending(authKey));
    if (stillQueued !== raw) continue;

    try {
      const res = await workerFetch("/api/bsplus/settings/sync", {
        method: "PUT",
        headers: clientHeaders(pending),
        body: pending.bodyText,
      });
      const text = await res.text();
      if (res.ok) {
        await redis.setex(redisKeys.syncGetCache(authKey), config.syncGetCacheTtlSec, text);
      } else {
        console.error("[sync-flush] worker PUT failed", res.status, text.slice(0, 200));
      }
    } catch (err) {
      console.error("[sync-flush] worker PUT error", authKey, err);
      await redis.sadd(redisKeys.syncQueue, authKey);
    } finally {
      const current = await redis.get(redisKeys.syncPending(authKey));
      if (current === raw) {
        await redis.del(redisKeys.syncPending(authKey));
      } else if (current) {
        await redis.sadd(redisKeys.syncQueue, authKey);
      }
    }
  }
}

export function startSyncFlushLoop(): void {
  setInterval(() => {
    void flushPendingSyncs().catch((err) => console.error("[sync-flush] loop", err));
  }, config.flushIntervalMs);
  console.log(`[sync-flush] every ${config.flushIntervalMs}ms`);
}