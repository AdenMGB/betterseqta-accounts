/** Temporary timetable relay telemetry — grep `tq-relay-obs` in wrangler tail / CF Workers logs. Set TQ_RELAY_OBS=0 to disable. */

export function tqRelayObsEnabled(env: { TQ_RELAY_OBS?: string } | undefined): boolean {
  const v = env?.TQ_RELAY_OBS?.trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

export function logTqRelayObs(
  env: { TQ_RELAY_OBS?: string } | undefined,
  payload: Record<string, unknown>,
): void {
  if (!tqRelayObsEnabled(env)) return;
  console.log(
    "[tq-relay-obs]",
    JSON.stringify({
      ts: new Date().toISOString(),
      ...payload,
    }),
  );
}

export function applyTqRelayStubObsHeaders(
  env: { TQ_RELAY_OBS?: string } | undefined,
  instanceHost: string,
  headers: Headers,
): void {
  headers.set("X-TQ-Instance-Host", instanceHost);
  headers.set("X-TQ-Relay-Obs", tqRelayObsEnabled(env) ? "1" : "0");
}
