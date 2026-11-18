import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { Redis } from "ioredis";
import { relayConfig } from "./config.js";
import { logTqRelayObs } from "./obs.js";
import { loadSharesForInstance } from "./store.js";
import { sortSharesByUpdatedAt, type StoredShare } from "./types.js";

export type ClientInfo = {
  cloudUserId: string;
  seqtaStudentId: number;
  shareCode: string;
  instanceHost: string;
};

type Room = Map<WebSocket, ClientInfo>;

export class RelayHub {
  private rooms = new Map<string, Room>();
  private redisPub: Redis | null = null;
  private redisSub: Redis | null = null;
  private readonly originId = randomUUID();

  attachRedis(pub: Redis, sub: Redis): void {
    this.redisPub = pub;
    this.redisSub = sub;
    void this.redisSub.subscribe(relayConfig.redisBroadcastChannel);
    this.redisSub.on("message", (channel: string, payload: string) => {
      if (channel !== relayConfig.redisBroadcastChannel || !payload) return;
      const sep = payload.indexOf(":");
      if (sep < 0) return;
      const origin = payload.slice(0, sep);
      const instanceHost = payload.slice(sep + 1);
      if (!instanceHost || origin === this.originId) return;
      void this.broadcastSnapshot(instanceHost, "redis");
    });
  }

  private room(instanceHost: string): Room {
    let r = this.rooms.get(instanceHost);
    if (!r) {
      r = new Map();
      this.rooms.set(instanceHost, r);
    }
    return r;
  }

  add(ws: WebSocket, info: ClientInfo): void {
    this.room(info.instanceHost).set(ws, info);
  }

  remove(ws: WebSocket): ClientInfo | undefined {
    for (const [host, room] of this.rooms.entries()) {
      const info = room.get(ws);
      if (info) {
        room.delete(ws);
        if (room.size === 0) this.rooms.delete(host);
        return info;
      }
    }
    return undefined;
  }

  socketCount(instanceHost: string): number {
    return this.room(instanceHost).size;
  }

  snapshotPayload(shares: StoredShare[]): string {
    return JSON.stringify({
      v: 1,
      type: "snapshot",
      shares: sortSharesByUpdatedAt(shares),
    });
  }

  sendError(ws: WebSocket, message: string): void {
    try {
      ws.send(JSON.stringify({ v: 1, type: "error", message }));
    } catch {
      /* closed */
    }
  }

  async notifyBroadcast(instanceHost: string): Promise<{ broadcast_sent: number; broadcast_failed: number; share_count: number }> {
    if (this.redisPub) {
      await this.redisPub.publish(relayConfig.redisBroadcastChannel, `${this.originId}:${instanceHost}`);
    }
    return this.broadcastSnapshot(instanceHost, "local");
  }

  async broadcastSnapshot(
    instanceHost: string,
    source: "local" | "redis" = "local",
  ): Promise<{ broadcast_sent: number; broadcast_failed: number; share_count: number }> {
    const room = this.room(instanceHost);
    if (room.size === 0) {
      return { broadcast_sent: 0, broadcast_failed: 0, share_count: 0 };
    }

    let shares: StoredShare[];
    try {
      shares = await loadSharesForInstance(instanceHost);
    } catch (err) {
      console.error("[tq-relay] broadcast load failed", instanceHost, err);
      return { broadcast_sent: 0, broadcast_failed: 0, share_count: 0 };
    }

    const json = this.snapshotPayload(shares);
    let broadcast_sent = 0;
    let broadcast_failed = 0;
    for (const [ws] of room.entries()) {
      try {
        ws.send(json);
        broadcast_sent += 1;
      } catch {
        broadcast_failed += 1;
        room.delete(ws);
      }
    }
    if (broadcast_sent > 0 || broadcast_failed > 0) {
      logTqRelayObs({
        event: "relay_broadcast",
        source,
        instance_host: instanceHost,
        share_count: shares.length,
        broadcast_sent,
        broadcast_failed,
      });
    }
    return { broadcast_sent, broadcast_failed, share_count: shares.length };
  }
}

export const relayHub = new RelayHub();