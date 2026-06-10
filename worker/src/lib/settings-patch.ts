const ENVELOPE_KEYS = new Set(["ok", "server"]);

export type LocalOnlyConfig = {
  hiddenKeys: readonly string[];
  hiddenKeyPrefixes?: readonly string[];
};

export function isLocalOnlyKey(key: string, config: LocalOnlyConfig): boolean {
  if (ENVELOPE_KEYS.has(key)) return true;
  if (config.hiddenKeys.includes(key)) return true;
  if (config.hiddenKeyPrefixes?.some((prefix) => key.startsWith(prefix))) return true;
  return false;
}

export function stripEnvelopeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!ENVELOPE_KEYS.has(key)) out[key] = value;
  }
  return out;
}

export function stripLocalOnlyKeys(obj: Record<string, unknown>, config: LocalOnlyConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isLocalOnlyKey(key, config)) out[key] = value;
  }
  return out;
}

export function sanitizeIncomingPatch(
  obj: Record<string, unknown>,
  config: LocalOnlyConfig,
): Record<string, unknown> {
  return stripLocalOnlyKeys(stripEnvelopeKeys(obj), config);
}

export function hydrateWithDefaults(
  stored: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaults, ...stored };
}

export function shallowMergePatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...current, ...patch };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
}

export function buildSparseDiff(
  baseline: Record<string, unknown>,
  target: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(baseline), ...Object.keys(target)]);
  for (const key of keys) {
    if (!deepEqual(baseline[key], target[key])) {
      patch[key] = target[key];
    }
  }
  return patch;
}

export function pickChangedPatch(
  current: Record<string, unknown>,
  incomingPatch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incomingPatch)) {
    if (!deepEqual(current[key], value)) {
      out[key] = value;
    }
  }
  return out;
}

export function hydrationAddedKeys(
  stored: Record<string, unknown>,
  hydrated: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(hydrated)) {
    if (!(key in stored)) return true;
  }
  return false;
}

export function parseSettingsJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}
