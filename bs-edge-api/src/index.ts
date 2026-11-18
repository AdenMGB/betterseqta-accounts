import "dotenv/config";
import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import httpProxy from "http-proxy";
import { WebSocketServer } from "ws";
import { assertConfig, config, publicHost } from "./config.js";
import { corsHeadersForRequest } from "./cors.js";
import { connectRedis, getRedis } from "./redis.js";
import { startSyncFlushLoop } from "./sync-flush.js";
import { handleHealth, handlePeers, handleProxy, handleSettingsSync } from "./routes.js";
import { assertRelayConfig } from "./tq-relay/config.js";
import { relayHub } from "./tq-relay/hub.js";
import { handleInternalRevokeHttp } from "./tq-relay/internal-http.js";
import {
  authorizeRelaySocket,
  bindRelayWs,
  isRelayWsPath,
  onRelayOpen,
} from "./tq-relay/ws-handler.js";

assertConfig();
assertRelayConfig();

const app = new Hono();

app.options("*", (c) => c.body(null, 200, corsHeadersForRequest(c.req.raw)));

app.on(["GET", "HEAD"], "/api/health", (c) => handleHealth(c.req.method));
app.on(["GET", "HEAD"], "/health", (c) => handleHealth(c.req.method));
app.on(["GET", "PUT"], "/api/bsplus/settings/sync", (c) => handleSettingsSync(c));
app.get("/api/bsplus/timetable-classmates/peers", (c) => handlePeers(c));
app.post("/internal/tq-relay/revoke", (c) => handleInternalRevokeHttp(c));

app.all("*", (c) => handleProxy(c));

const relayWss = new WebSocketServer({ noServer: true });

const workerWsProxy = httpProxy.createProxyServer({
  target: config.workerUpstream,
  changeOrigin: true,
  ws: true,
});

async function main(): Promise<void> {
  const listener = getRequestListener(app.fetch);
  const server = createServer(listener);

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (req.url && (req.url === "/api/health" || req.url.startsWith("/api/health?") || req.url === "/health")) {
      socket.destroy();
      return;
    }

    const reqUrl = new URL(req.url ?? "/", "http://127.0.0.1");
    if (isRelayWsPath(reqUrl.pathname)) {
      void (async () => {
        const auth = await authorizeRelaySocket(req, reqUrl);
        if (auth instanceof Response) {
          const payload = JSON.stringify({ error: auth.statusText || "Unauthorized" });
          socket.write(
            `HTTP/1.1 ${auth.status} ${auth.statusText}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n${payload}`,
          );
          socket.destroy();
          return;
        }
        relayWss.handleUpgrade(req, socket, head, (ws) => {
          void onRelayOpen(ws, auth);
          bindRelayWs(ws, auth);
        });
      })().catch((err) => {
        console.error("[tq-relay] upgrade failed", err);
        socket.destroy();
      });
      return;
    }

    req.headers["x-forwarded-host"] = publicHost();
    req.headers["x-forwarded-proto"] = "https";
    workerWsProxy.ws(req, socket, head);
  });

  workerWsProxy.on("error", (err, req, socket) => {
    console.error("[ws-proxy]", err.message, req.url);
    if ("destroy" in socket && typeof socket.destroy === "function") socket.destroy();
  });

  await new Promise<void>((resolve) => {
    server.listen(config.port, "0.0.0.0", () => {
      console.log(`bs-edge-api listening on :${config.port}`);
      console.log(`public origin: ${config.publicOrigin}`);
      console.log(`worker upstream: ${config.workerUpstream}`);
      console.log(`/api/health answered locally (not proxied to Worker)`);
      console.log(`timetable relay WebSocket served locally (replaces Durable Object)`);
      resolve();
    });
  });

  try {
    await connectRedis();
    const redis = getRedis();
    relayHub.attachRedis(redis, redis.duplicate());
    startSyncFlushLoop();
  } catch (err) {
    console.error("[redis] unavailable — hot routes may fail; /api/health still OK", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});