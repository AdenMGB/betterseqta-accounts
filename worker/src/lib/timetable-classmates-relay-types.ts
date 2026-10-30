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

export function isValidBundle(b: unknown): b is RelayBundle {
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

export function isValidPeriod(period: unknown): period is { from: string; until: string } {
  if (!period || typeof period !== "object") return false;
  const p = period as Record<string, unknown>;
  return typeof p.from === "string" && p.from.length > 0 && typeof p.until === "string" && p.until.length > 0;
}

export function sanitizeBundles(bundles: unknown): RelayBundle[] {
  if (!Array.isArray(bundles)) return [];
  return bundles.filter(isValidBundle).slice(0, 300);
}

export function sortSharesByUpdatedAt(shares: StoredShare[]): StoredShare[] {
  return [...shares].sort((a, b) => b.updated_at - a.updated_at);
}
