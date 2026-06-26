const GENERIC_DEVICE_NAMES = new Set([
  "Website",
  "Website (Discord)",
  "Desktop Client",
  "Extension",
  "DesQTA",
  "DesQTA (Discord)",
  "BetterSEQTA Plus",
  "BetterSEQTA Plus (Discord)",
  "BetterSEQTA Accounts",
  "BetterSEQTA Site",
  "BetterSEQTA+",
  "accounts.betterseqta.org",
]);

export function sessionTitle(platform: string): string {
  switch (platform) {
    case "web":
      return "BetterSEQTA Accounts";
    case "oauth":
      return "BetterSEQTA Site";
    case "desqta":
      return "DesQTA";
    case "bsplus":
      return "BetterSEQTA+";
    default:
      return platform;
  }
}

export function sessionSubtitle(platform: string): string {
  switch (platform) {
    case "web":
    case "oauth":
      return "Website";
    case "desqta":
      return "Desktop Client";
    case "bsplus":
      return "Extension";
    default:
      return "Unknown";
  }
}

export function friendlyDeviceNameFromUserAgent(ua: string | null | undefined): string | null {
  if (!ua?.trim()) return null;

  const browser = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/") && !ua.includes("Edg/")
      ? "Chrome"
      : ua.includes("Firefox/")
        ? "Firefox"
        : ua.includes("Safari/") && !ua.includes("Chrome/")
          ? "Safari"
          : null;

  const os = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac OS X") || ua.includes("Macintosh")
      ? "macOS"
      : ua.includes("Android")
        ? "Android"
        : ua.includes("iPhone") || ua.includes("iPad")
          ? "iOS"
          : ua.includes("Linux")
            ? "Linux"
            : null;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;

  const trimmed = ua.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

export function resolveSessionDeviceName(
  storedDeviceName: string | null,
  userAgent: string | null,
  platform?: string,
): string | null {
  const stored = storedDeviceName?.trim() || null;
  const subtitle = platform ? sessionSubtitle(platform) : null;
  if (stored && !GENERIC_DEVICE_NAMES.has(stored) && stored !== subtitle) return stored;
  return friendlyDeviceNameFromUserAgent(userAgent);
}

export function deviceNameForNewSession(
  request: Request,
  provided?: string | null,
): string | null {
  const trimmed = provided?.trim();
  if (trimmed) return trimmed.slice(0, 120);
  return friendlyDeviceNameFromUserAgent(request.headers.get("User-Agent"));
}
