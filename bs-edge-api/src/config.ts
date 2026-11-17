const DEFAULT_PORT = 8789;
const DEFAULT_FLUSH_MS = 5000;
const DEFAULT_PEERS_TTL_SEC = 20;
const DEFAULT_SYNC_GET_TTL_SEC = 15;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: envInt("PORT", DEFAULT_PORT),
  workerUpstream: (process.env.WORKER_UPSTREAM ?? "https://worker.accounts.betterseqta.org").replace(/\/$/, ""),
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  flushIntervalMs: envInt("SYNC_FLUSH_INTERVAL_MS", DEFAULT_FLUSH_MS),
  peersCacheTtlSec: envInt("PEERS_CACHE_TTL_SEC", DEFAULT_PEERS_TTL_SEC),
  syncGetCacheTtlSec: envInt("SYNC_GET_CACHE_TTL_SEC", DEFAULT_SYNC_GET_TTL_SEC),
  publicOrigin: (process.env.PUBLIC_ORIGIN ?? "https://accounts.betterseqta.org").replace(/\/$/, ""),
} as const;

export function publicHost(): string {
  return new URL(config.publicOrigin).host;
}

export function assertConfig(): void {
  if (!config.workerUpstream.startsWith("http")) {
    throw new Error("WORKER_UPSTREAM must be an http(s) URL");
  }
}