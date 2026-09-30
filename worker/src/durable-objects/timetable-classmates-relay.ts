export type RelayBundle = {
  class_key: string;
  iv_b64: string;
  ct_b64: string;
};

export type StoredShare = {
  seqta_student_id: number;
  cloud_user_id: string;
  share_code: string;
  period: { from: string; until: string };
  updated_at: number;
  bundles: RelayBundle[];
};

type ClientInfo = {
  cloudUserId: string;
  seqtaStudentId: number;
  shareCode: string;
};

type InboundPublish = {
  v: 1;
  type: "publish";
  period: { from: string; until: string };
  bundles: RelayBundle[];
};

type InboundRevoke = {
  v: 1;
  type: "revoke";
};

function isValidBundle(b: unknown): b is RelayBundle {
  if (!b || typeof b !== "object") return false;
  const row = b as Record<string, unknown>;
  return (
    typeof row.class_key === "string" &&
    row.class_key.length > 0 &&
    row.class_key.length <= 128 &&
    typeof row.iv_b64 === "string" &&
    row.iv_b64.length > 0 &&
    row.iv_b64.length <= 64 &&
    typeof row.ct_b64 === "string" &&
    row.ct_b64.length > 0 &&
    row.ct_b64.length <= 65536
  );
}

function isValidPeriod(period: unknown): period is { from: string; until: string } {
  if (!period || typeof period !== "object") return false;
  const p = period as Record<string, unknown>;
  return typeof p.from === "string" && p.from.length > 0 && typeof p.until === "string" && p.until.length > 0;
}

export class TimetableClassmatesRelay implements DurableObject {
  private shares = new Map<number, StoredShare>();
  private sockets = new Map<WebSocket, ClientInfo>();

  constructor(private state: DurableObjectState) {
    void this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<[number, StoredShare][]>("shares");
      if (stored) this.shares = new Map(stored);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST" && request.headers.get("X-TQ-Internal-Revoke") === "1") {
      const seqtaStudentId = Number(request.headers.get("X-TQ-Seqta-Student-Id"));
      if (!Number.isInteger(seqtaStudentId) || seqtaStudentId <= 0) {
        return new Response(JSON.stringify({ error: "Invalid student id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      this.shares.delete(seqtaStudentId);
      await this.state.storage.put("shares", [...this.shares.entries()]);
      this.broadcastSnapshot();
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

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server, { cloudUserId, seqtaStudentId, shareCode });
    return new Response(null, { status: 101, webSocket: client });
  }

  private acceptSocket(ws: WebSocket, info: ClientInfo): void {
    ws.accept();
    this.sockets.set(ws, info);
    this.sendSnapshot(ws);

    ws.addEventListener("message", (event) => {
      void this.onMessage(ws, event.data);
    });
    ws.addEventListener("close", () => {
      this.sockets.delete(ws);
    });
    ws.addEventListener("error", () => {
      this.sockets.delete(ws);
    });
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
      this.shares.set(info.seqtaStudentId, share);
      await this.state.storage.put("shares", [...this.shares.entries()]);
      this.broadcastSnapshot();
      return;
    }

    if (msg.type === "revoke") {
      this.shares.delete(info.seqtaStudentId);
      await this.state.storage.put("shares", [...this.shares.entries()]);
      this.broadcastSnapshot();
      return;
    }

    this.sendError(ws, "Unknown message type");
  }

  private snapshotPayload(): { v: 1; type: "snapshot"; shares: StoredShare[] } {
    return {
      v: 1,
      type: "snapshot",
      shares: [...this.shares.values()].sort((a, b) => b.updated_at - a.updated_at),
    };
  }

  private sendSnapshot(ws: WebSocket): void {
    try {
      ws.send(JSON.stringify(this.snapshotPayload()));
    } catch {
      /* closed */
    }
  }

  private broadcastSnapshot(): void {
    const json = JSON.stringify(this.snapshotPayload());
    for (const ws of this.sockets.keys()) {
      try {
        ws.send(json);
      } catch {
        this.sockets.delete(ws);
      }
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
