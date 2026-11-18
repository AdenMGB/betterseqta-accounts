const DEFAULT_D1_DATABASE_ID = "713549d9-b2fb-4407-b12d-6b5e207c825c";

function truthyRelayObs(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required for timetable relay on edge`);
  return v;
}

export const relayConfig = {
  get jwtSecret(): Uint8Array {
    return new TextEncoder().encode(requireEnv("JWT_SECRET"));
  },
  get edgeRelaySecret(): string {
    return requireEnv("EDGE_RELAY_SECRET");
  },
  get accountId(): string {
    return requireEnv("CLOUDFLARE_ACCOUNT_ID");
  },
  get apiToken(): string {
    return requireEnv("CLOUDFLARE_API_TOKEN");
  },
  get databaseId(): string {
    return (process.env.D1_DATABASE_ID ?? DEFAULT_D1_DATABASE_ID).trim();
  },
  get obsEnabled(): boolean {
    return truthyRelayObs(process.env.TQ_RELAY_OBS);
  },
  redisBroadcastChannel: "tq-relay:broadcast",
} as const;

export function assertRelayConfig(): void {
  requireEnv("JWT_SECRET");
  requireEnv("EDGE_RELAY_SECRET");
  requireEnv("CLOUDFLARE_ACCOUNT_ID");
  requireEnv("CLOUDFLARE_API_TOKEN");
}