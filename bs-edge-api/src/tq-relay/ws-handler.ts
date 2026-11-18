import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import { relayConfig } from "./config.js";
import { relayHub, type ClientInfo } from "./hub.js";
import {
  getActiveMembership,
  normalizeInstanceHost,
  shareCodeFromIdentityDigest,
} from "./membership.js";
import { logTqRelayObs } from "./obs.js";
import { verifyRelayToken } from "./relay-token.js";
import { deleteShare, loadSharesForInstance, upsertShare } from "./store.js";
import { isValidBundle, isValidPeriod, type RelayBundle, type StoredShare } from "./types.js";

type InboundPublish = {
  v: 1;
  type: "publish";
  period: { from: string; until: string };
  bundles: RelayBundle[];
};

export function isRelayWsPath(pathname: string): boolean {
  return pathname === "/api/bsplus/timetable-classmates/relay/ws";
}

export async function authorizeRelaySocket(req: IncomingMessage, reqUrl: URL): Promise<ClientInfo | Response> {
  const instanceHost = normalizeInstanceHost(reqUrl.searchParams.get("instance_host"));
  const relayToken = reqUrl.searchParams.get("relay_token")?.trim();
  if (!instanceHost || !relayToken) {
    return new Response("Invalid relay connection", { status: 422 });
  }

  const claims = await verifyRelayToken(relayToken, relayConfig.jwtSecret);
  if (!claims || claims.instance_host !== instanceHost) {
    return new Response("Invalid relay token", { status: 401 });
  }

  const membership = await getActiveMembership(claims.cloud_user_id, instanceHost);
  if (!membership) {
    return new Response("Not registered on this school instance", { status: 404 });
  }
  if (membership.seqta_student_id !== claims.seqta_student_id) {
    return new Response("Relay token does not match membership", { status: 401 });
  }
  const expectedShare = shareCodeFromIdentityDigest(membership.identity_binding_digest);
  if (!expectedShare || expectedShare !== claims.share_code) {
    return new Response("Invalid relay token", { status: 401 });
  }

  return {
    cloudUserId: claims.cloud_user_id,
    seqtaStudentId: claims.seqta_student_id,
    shareCode: claims.share_code,
    instanceHost,
  };
}

export async function onRelayOpen(ws: WebSocket, info: ClientInfo): Promise<void> {
  relayHub.add(ws, info);
  try {
    const shares = await loadSharesForInstance(info.instanceHost);
    ws.send(relayHub.snapshotPayload(shares));
    logTqRelayObs({
      event: "relay_ws_connect",
      instance_host: info.instanceHost,
      seqta_student_id: info.seqtaStudentId,
      connected_sockets: relayHub.socketCount(info.instanceHost),
      share_count: shares.length,
    });
  } catch (err) {
    console.error("[tq-relay] initial snapshot failed", info.instanceHost, err);
    relayHub.sendError(ws, "Relay unavailable");
    ws.close(1011, "Relay unavailable");
  }
}

async function onMessage(ws: WebSocket, data: WebSocket.RawData, info: ClientInfo): Promise<void> {
  let parsed: unknown;
  try {
    const text = typeof data === "string" ? data : data.toString("utf8");
    parsed = JSON.parse(text);
  } catch {
    relayHub.sendError(ws, "Invalid JSON");
    return;
  }

  const msg = parsed as { v?: number; type?: string };
  if (msg.v !== 1) {
    relayHub.sendError(ws, "Unsupported protocol version");
    return;
  }

  if (msg.type === "publish") {
    const body = parsed as InboundPublish;
    if (!isValidPeriod(body.period) || !Array.isArray(body.bundles)) {
      relayHub.sendError(ws, "Invalid publish");
      return;
    }
    const bundles = body.bundles.filter(isValidBundle).slice(0, 300);
    if (bundles.length === 0) {
      logTqRelayObs({
        event: "relay_publish_rejected",
        instance_host: info.instanceHost,
        seqta_student_id: info.seqtaStudentId,
        reason: "no_valid_bundles",
      });
      relayHub.sendError(ws, "Invalid publish");
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
      await upsertShare(info.instanceHost, share);
    } catch (err) {
      console.error("[tq-relay] publish persist failed", info.instanceHost, info.seqtaStudentId, err);
      relayHub.sendError(ws, "Publish failed");
      return;
    }

    const broadcast = await relayHub.notifyBroadcast(info.instanceHost);
    const otherPeers = Math.max(0, relayHub.socketCount(info.instanceHost) - 1);
    logTqRelayObs({
      event: "relay_publish_ok",
      instance_host: info.instanceHost,
      seqta_student_id: info.seqtaStudentId,
      bundle_count: bundles.length,
      period_from: body.period.from,
      period_until: body.period.until,
      connected_sockets: relayHub.socketCount(info.instanceHost),
      other_connected_sockets: otherPeers,
      no_ws_peers: otherPeers === 0,
      ...broadcast,
    });
    return;
  }

  if (msg.type === "revoke") {
    try {
      await deleteShare(info.instanceHost, info.seqtaStudentId);
    } catch (err) {
      console.error("[tq-relay] revoke persist failed", info.instanceHost, info.seqtaStudentId, err);
      relayHub.sendError(ws, "Revoke failed");
      return;
    }
    const broadcast = await relayHub.notifyBroadcast(info.instanceHost);
    logTqRelayObs({
      event: "relay_revoke_ws",
      instance_host: info.instanceHost,
      seqta_student_id: info.seqtaStudentId,
      ...broadcast,
    });
    return;
  }

  relayHub.sendError(ws, "Unknown message type");
}

export function bindRelayWs(ws: WebSocket, info: ClientInfo): void {
  ws.on("message", (data) => {
    void onMessage(ws, data, info);
  });
  ws.on("close", () => {
    const closed = relayHub.remove(ws);
    if (closed) {
      logTqRelayObs({
        event: "relay_ws_close",
        instance_host: closed.instanceHost,
        seqta_student_id: closed.seqtaStudentId,
        connected_sockets: relayHub.socketCount(closed.instanceHost),
      });
    }
  });
  ws.on("error", () => {
    relayHub.remove(ws);
  });
}

export async function handleInternalRevoke(instanceHost: string, seqtaStudentId: number): Promise<void> {
  const broadcast = await relayHub.notifyBroadcast(instanceHost);
  logTqRelayObs({
    event: "relay_revoke",
    instance_host: instanceHost,
    seqta_student_id: seqtaStudentId,
    ...broadcast,
  });
}