import "dotenv/config";
import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import httpProxy from "http-proxy";
import { assertConfig, config, publicHost } from "./config.js";
import { connectRedis } from "./redis.js";
import { startSyncFlushLoop } from "./sync-flush.js";
import { handleHealth, handlePeers, handleProxy, handleSettingsSync } from "./routes.js";

assertConfig();

const app = new Hono();

app.options("*", (c) =>
  c.body(null, 200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-ID, X-API-Key, Cookie",
  }),
);

app.on(["GET", "HEAD"], "/api/health", (c) => handleHealth(c.req.method));
app.on(["GET", "HEAD"], "/health", (c) => handleHealth(c.req.method));
app.on(["GET", "PUT"], "/api/bsplus/settings/sync", (c) => handleSettingsSync(c));
app.get("/api/bsplus/timetable-classmates/peers", (c) => handlePeers(c));

app.all("*", (c) => handleProxy(c));

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
      resolve();
    });
  });

  try {
    await connectRedis();
    startSyncFlushLoop();
  } catch (err) {
    console.error("[redis] unavailable — hot routes may fail; /api/health still OK", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});