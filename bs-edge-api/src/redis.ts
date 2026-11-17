import { Redis } from "ioredis";
import { config } from "./config.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  const r = getRedis();
  if (r.status === "wait") await r.connect();
  await r.ping();
}

export const redisKeys = {
  syncPending: (authKey: string) => `bs:sync:pending:${authKey}`,
  syncQueue: "bs:sync:queue",
  syncGetCache: (authKey: string) => `bs:sync:get:${authKey}`,
  peersCache: (authKey: string, instanceHost: string) => `bs:peers:${authKey}:${instanceHost}`,
} as const;