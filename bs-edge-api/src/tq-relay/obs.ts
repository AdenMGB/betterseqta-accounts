import { relayConfig } from "./config.js";

export function logTqRelayObs(fields: Record<string, unknown>): void {
  if (!relayConfig.obsEnabled) return;
  console.log("[tq-relay-obs]", JSON.stringify(fields));
}