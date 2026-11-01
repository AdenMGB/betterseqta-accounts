const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXTENSION_CHANNELS = new Set(["stable", "nightly", "unknown"]);

export type BsplusExtensionMeta = {
  version: string;
  channel: "stable" | "nightly" | "unknown";
  browser: string;
};

export type BsplusInstallLinkPayload = {
  installId: string;
  extension: BsplusExtensionMeta;
  deviceName: string | null;
  lastSeenAt: string;
};

export function parseInstallId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase();
  if (!UUID_RE.test(id)) return null;
  return id;
}

export function parseIso8601Utc(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function parseExtensionMeta(raw: unknown): BsplusExtensionMeta | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "string" ? o.version.trim() : "";
  if (!version || version.length > 64) return null;
  if (!/^[0-9A-Za-z.+~-]+$/.test(version)) return null;

  const channelRaw = typeof o.channel === "string" ? o.channel.trim().toLowerCase() : "unknown";
  const channel = EXTENSION_CHANNELS.has(channelRaw)
    ? (channelRaw as BsplusExtensionMeta["channel"])
    : "unknown";

  const browser = typeof o.browser === "string" ? o.browser.trim().toLowerCase() : "";
  if (!browser || browser.length > 32 || !/^[a-z0-9_-]+$/.test(browser)) return null;

  return { version, channel, browser };
}

export function parseDeviceName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > 200) return null;
  return name;
}

export function parseInstallLinkBody(body: unknown): BsplusInstallLinkPayload | { error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;
  const installId = parseInstallId(o.installId);
  if (!installId) return { error: "installId must be a UUID" };

  const extension = parseExtensionMeta(o.extension);
  if (!extension) return { error: "extension must include version, channel, and browser" };

  const lastSeenAt = parseIso8601Utc(o.lastSeenAt);
  if (!lastSeenAt) return { error: "lastSeenAt must be ISO-8601 UTC" };

  const deviceName = parseDeviceName(o.deviceName);

  return { installId, extension, deviceName, lastSeenAt };
}

export type BsplusInstallRow = {
  install_id: string;
  cloud_user_id: string;
  device_name: string | null;
  extension_json: string;
  last_seen_at: string;
  linked_at: string;
  updated_at: string;
};

export function installRowToApi(row: BsplusInstallRow) {
  let extension: BsplusExtensionMeta = { version: "unknown", channel: "unknown", browser: "chrome" };
  try {
    const parsed = parseExtensionMeta(JSON.parse(row.extension_json));
    if (parsed) extension = parsed;
  } catch {
    /* keep default */
  }
  return {
    installId: row.install_id,
    deviceName: row.device_name,
    extension,
    lastSeenAt: row.last_seen_at,
    linkedAt: row.linked_at,
  };
}

export function isoNow(): string {
  return new Date().toISOString();
}
