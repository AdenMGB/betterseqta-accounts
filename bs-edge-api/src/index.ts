import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { assertConfig, config } from "./config.js";
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

app.get("/api/health", () => handleHealth());
app.on(["GET", "PUT"], "/api/bsplus/settings/sync", (c) => handleSettingsSync(c));
app.get("/api/bsplus/timetable-classmates/peers", (c) => handlePeers(c));

app.all("*", (c) => handleProxy(c));

async function main(): Promise<void> {
  await connectRedis();
  startSyncFlushLoop();
  serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, () => {
    console.log(`bs-edge-api listening on :${config.port}`);
    console.log(`worker upstream: ${config.workerUpstream}`);
    console.log(`public origin: ${config.publicOrigin}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});