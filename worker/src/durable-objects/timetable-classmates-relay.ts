import {
  deleteShare,
  loadSharesForInstance,
  upsertShare,
} from "../lib/timetable-classmates-relay-store";
import {
  isValidBundle,
  isValidPeriod,
  sortSharesByUpdatedAt,
  type RelayBundle,
  type StoredShare,
} from "../lib/timetable-classmates-relay-types";
import { logTqRelayObs } from "../lib/tq-relay-observability";
import type { Env } from "../types/env";

type ObsEnv = { TQ_RELAY_OBS?: string };

function obsEnvFromRelayHeader(enabled: boolean): ObsEnv {
  return enabled ? {} : { TQ_RELAY_OBS: "0" };
}

type ClientInfo = {
  cloudUserId: string;
  seqtaStudentId: number;
  shareCode: string;
  instanceHost: string;
  obs: ObsEnv;
};

type InboundPublish = {
  v: 1;
  type: "publish";
  period: { from: string; until: string };
  bundles: RelayBundle[];
};

export class TimetableClassmatesRelay implements DurableObject {
  private sockets = new Map<WebSocket, ClientInfo>();

  constructor(_state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const obs = obsEnvFromRelayHeader(request.headers.get("X-TQ-Relay-Obs") === "1");
    const instanceHost = request.headers.get("X-TQ-Instance-Host")?.trim() ?? "";

    if (request.method === "POST" && request.headers.get("X-TQ-Internal-Revoke") === "1") {
      const seqtaStudentId = Number(request.headers.get("X-TQ-Seqta-Student-Id"));
      if (!Number.isInteger(seqtaStudentId) || seqtaStudentId <= 0) {
        return new Response(JSON.stringify({ error: "Invalid student id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (!instanceHost) {
        return new Response(JSON.stringify({ error: "Missing instance host" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await deleteShare(this.env.DB, instanceHost, seqtaStudentId);
      const shares = await loadSharesForInstance(this.env.DB, instanceHost);
      const broadcast = await this.broadcastSnapshot(instanceHost, shares);
      logTqRelayObs(obs, {
        event: "relay_revoke",
        instance_host: instanceHost,
        seqta_student_id: seqtaStudentId,
        share_count: shares.length,
        ...broadcast,
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const cloudUserId = request.headers.get("X-TQ-Cloud-User-Id") ?? "";
    const seqtaStudentId = Number(request.headers.get("X-TQ-Seqta-Student-Id"));
    const shareCode = request.headers.get("X-TQ-Share-Code") ?? "";
    if (!cloudUserId || !Number.isFinite(seqtaStudentId) || !shareCode) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!instanceHost) {
      return new Response("Missing instance host", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server, { cloudUserId, seqtaStudentId, shareCode, instanceHost, obs });
    return new Response(null, { status: 101, webSocket: client });
  }

  private acceptSocket(ws: WebSocket, info: ClientInfo): void {
    ws.accept();
    this.sockets.set(ws, info);
    void this.sendInitialSnapshot(ws, info);

    ws.addEventListener("message", (event) => {
      void this.onMessage(ws, event.data);
    });
    ws.addEventListener("close", () => {
      const closed = this.sockets.get(ws);
      this.sockets.delete(ws);
      if (closed) {
        logTqRelayObs(closed.obs, {
          event: "relay_ws_close",
          instance_host: closed.instanceHost || undefined,
          seqta_student_id: closed.seqtaStudentId,
          connected_sockets: this.sockets.size,
        });
      }
    });
    ws.addEventListener("error", () => {
      this.sockets.delete(ws);
    });
  }

  private async sendInitialSnapshot(ws: WebSocket, info: ClientInfo): Promise<void> {
    try {
      const shares = await loadSharesForInstance(this.env.DB, info.instanceHost);
      this.sendSnapshot(ws, shares);
      logTqRelayObs(info.obs, {
        event: "relay_ws_connect",
        instance_host: info.instanceHost || undefined,
        seqta_student_id: info.seqtaStudentId,
        connected_sockets: this.sockets.size,
        share_count: shares.length,
      });
    } catch (err) {
      console.error("[tq-relay] initial snapshot failed", info.instanceHost, err);
      this.sendError(ws, "Relay unavailable");
      try {
        ws.close(1011, "Relay unavailable");
      } catch {
        /* closed */
      }
    }
  }

  private async onMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const info = this.sockets.get(ws);
    if (!info) return;

    let parsed: unknown;
    try {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      parsed = JSON.parse(text);
    } catch {
      this.sendError(ws, "Invalid JSON");
      return;
    }

    const msg = parsed as { v?: number; type?: string };
    if (msg.v !== 1) {
      this.sendError(ws, "Unsupported protocol version");
      return;
    }

    if (msg.type === "publish") {
      const body = parsed as InboundPublish;
      if (!isValidPeriod(body.period) || !Array.isArray(body.bundles)) {
        this.sendError(ws, "Invalid publish");
        return;
      }
      const bundles = body.bundles.filter(isValidBundle).slice(0, 300);
      if (bundles.length === 0) {
        logTqRelayObs(info.obs, {
          event: "relay_publish_rejected",
          instance_host: info.instanceHost || undefined,
          seqta_student_id: info.seqtaStudentId,
          reason: "no_valid_bundles",
        });
        this.sendError(ws, "Invalid publish");
        return;
      }
      const share: StoredShare = {
        seqta_student_id: info.seqtaStudentId,
        cloud_user_id: info.cloudUserId,
        share_code: info.shareCode,
        period: body.period,
        updated_at: Date.now(),
        bundles,
      };
      try {
        await upsertShare(this.env.DB, info.instanceHost, share);
      } catch (err) {
        console.error("[tq-relay] publish persist failed", info.instanceHost, info.seqtaStudentId, err);
        this.sendError(ws, "Publish failed");
        return;
      }

      const shares = await loadSharesForInstance(this.env.DB, info.instanceHost);
      const broadcast = await this.broadcastSnapshot(info.instanceHost, shares, ws);
      const otherPeers = this.sockets.size - 1;
      logTqRelayObs(info.obs, {
        event: "relay_publish_ok",
        instance_host: info.instanceHost || undefined,
        seqta_student_id: info.seqtaStudentId,
        bundle_count: bundles.length,
        period_from: body.period.from,
        period_until: body.period.until,
        share_count: shares.length,
        connected_sockets: this.sockets.size,
        other_connected_sockets: otherPeers,
        no_ws_peers: otherPeers === 0,
        ...broadcast,
      });
      this.closeSocketAfterSuccess(ws);
      return;
    }

    if (msg.type === "revoke") {
      try {
        await deleteShare(this.env.DB, info.instanceHost, info.seqtaStudentId);
      } catch (err) {
        console.error("[tq-relay] revoke persist failed", info.instanceHost, info.seqtaStudentId, err);
        this.sendError(ws, "Revoke failed");
        return;
      }
      const shares = await loadSharesForInstance(this.env.DB, info.instanceHost);
      const broadcast = await this.broadcastSnapshot(info.instanceHost, shares, ws);
      logTqRelayObs(info.obs, {
        event: "relay_revoke_ws",
        instance_host: info.instanceHost || undefined,
        seqta_student_id: info.seqtaStudentId,
        share_count: shares.length,
        ...broadcast,
      });
      this.closeSocketAfterSuccess(ws);
      return;
    }

    this.sendError(ws, "Unknown message type");
  }

  private snapshotPayload(shares: StoredShare[]): { v: 1; type: "snapshot"; shares: StoredShare[] } {
    return {
      v: 1,
      type: "snapshot",
      shares: sortSharesByUpdatedAt(shares),
    };
  }

  private sendSnapshot(ws: WebSocket, shares: StoredShare[]): void {
    try {
      ws.send(JSON.stringify(this.snapshotPayload(shares)));
    } catch {
      /* closed */
    }
  }

  private async broadcastSnapshot(
    instanceHost: string,
    shares?: StoredShare[],
    excludeWs?: WebSocket,
  ): Promise<{ broadcast_sent: number; broadcast_failed: number }> {
    const resolved = shares ?? (await loadSharesForInstance(this.env.DB, instanceHost));
    const json = JSON.stringify(this.snapshotPayload(resolved));
    let broadcast_sent = 0;
    let broadcast_failed = 0;
    for (const [ws] of this.sockets.entries()) {
      if (excludeWs && ws === excludeWs) continue;
      try {
        ws.send(json);
        broadcast_sent += 1;
      } catch {
        broadcast_failed += 1;
        this.sockets.delete(ws);
      }
    }
    return { broadcast_sent, broadcast_failed };
  }

  private closeSocketAfterSuccess(ws: WebSocket): void {
    this.sockets.delete(ws);
    try {
      ws.close(1000, "OK");
    } catch {
      /* closed */
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    try {
      ws.send(JSON.stringify({ v: 1, type: "error", message }));
    } catch {
      /* closed */
    }
  }
}
