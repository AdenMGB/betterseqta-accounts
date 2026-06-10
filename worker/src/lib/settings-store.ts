import { sha256HexCanonicalJson, stableStringify } from "../lib/json-stable";
import {
  buildSparseDiff,
  hydrateWithDefaults,
  hydrationAddedKeys,
  parseSettingsJson,
  pickChangedPatch,
  sanitizeIncomingPatch,
  shallowMergePatch,
} from "../lib/settings-patch";
import { bsplusKnownDefaults, desqtaDefaults } from "../settings/defaults";
import { bsplusLocalOnly, desqtaLocalOnly } from "../settings/local-only";
import type { Env } from "../types/env";

type D1Database = Env["DB"];

export type HydratedSettingsResult = {
  hydrated: Record<string, unknown>;
  backfilled: boolean;
};

export async function loadHydratedDesqtaSettings(
  db: D1Database,
  userId: string,
): Promise<HydratedSettingsResult & { rowExists: boolean }> {
  const result = await db.prepare("SELECT data FROM settings WHERE user_id = ?").bind(userId).first();
  const stored = parseSettingsJson(result ? (result as { data: string }).data : null);
  const hydrated = hydrateWithDefaults(stored, desqtaDefaults);
  const backfilled = result != null && hydrationAddedKeys(stored, hydrated);
  return { hydrated, backfilled, rowExists: result != null };
}

export async function persistDesqtaSettingsIfBackfilled(
  db: D1Database,
  userId: string,
  stored: Record<string, unknown>,
  hydrated: Record<string, unknown>,
): Promise<void> {
  if (!hydrationAddedKeys(stored, hydrated)) return;
  await db
    .prepare("INSERT OR REPLACE INTO settings (user_id, data) VALUES (?, ?)")
    .bind(userId, JSON.stringify(hydrated))
    .run();
}

export async function loadAndPersistHydratedDesqta(
  db: D1Database,
  userId: string,
): Promise<{ hydrated: Record<string, unknown>; rowExists: boolean }> {
  const result = await db.prepare("SELECT data FROM settings WHERE user_id = ?").bind(userId).first();
  const stored = parseSettingsJson(result ? (result as { data: string }).data : null);
  const hydrated = hydrateWithDefaults(stored, desqtaDefaults);
  if (result != null && hydrationAddedKeys(stored, hydrated)) {
    await db
      .prepare("UPDATE settings SET data = ? WHERE user_id = ?")
      .bind(JSON.stringify(hydrated), userId)
      .run();
  }
  return { hydrated, rowExists: result != null };
}

export function sanitizeDesqtaPatch(incoming: Record<string, unknown>): Record<string, unknown> {
  return sanitizeIncomingPatch(incoming, desqtaLocalOnly);
}

export function mergeDesqtaPatch(
  hydrated: Record<string, unknown>,
  incoming: Record<string, unknown>,
): { merged: Record<string, unknown>; effectivePatch: Record<string, unknown>; changed: boolean } {
  const sanitized = sanitizeDesqtaPatch(incoming);
  const effectivePatch = pickChangedPatch(hydrated, sanitized);
  if (Object.keys(effectivePatch).length === 0) {
    return { merged: hydrated, effectivePatch, changed: false };
  }
  const merged = shallowMergePatch(hydrated, effectivePatch);
  return { merged, effectivePatch, changed: true };
}

export async function documentsEqual(a: Record<string, unknown>, b: Record<string, unknown>): Promise<boolean> {
  return stableStringify(a) === stableStringify(b);
}

export function buildDesqtaDownloadSettings(
  serverHydrated: Record<string, unknown>,
  localSettings: unknown,
): { settings: Record<string, unknown>; settings_format: "patch" | "full" } {
  if (localSettings && typeof localSettings === "object" && !Array.isArray(localSettings)) {
    const local = sanitizeDesqtaPatch(localSettings as Record<string, unknown>);
    return {
      settings: buildSparseDiff(local, serverHydrated),
      settings_format: "patch",
    };
  }
  return { settings: serverHydrated, settings_format: "full" };
}

export async function loadHydratedBsplusData(
  db: D1Database,
  userId: string,
): Promise<{ hydrated: Record<string, unknown>; rowExists: boolean; schemaVersion: number; updatedAt: string | null }> {
  const row = await db
    .prepare("SELECT schema_version, data, updated_at FROM bsplus_settings_sync WHERE user_id = ?")
    .bind(userId)
    .first();
  if (!row) {
    return { hydrated: { ...bsplusKnownDefaults }, rowExists: false, schemaVersion: 1, updatedAt: null };
  }
  const stored = parseSettingsJson(row.data as string);
  const hydrated = hydrateWithDefaults(stored, bsplusKnownDefaults);
  return {
    hydrated,
    rowExists: true,
    schemaVersion: row.schema_version as number,
    updatedAt: row.updated_at as string,
  };
}

export async function loadAndPersistHydratedBsplus(
  db: D1Database,
  userId: string,
): Promise<{ hydrated: Record<string, unknown>; rowExists: boolean; schemaVersion: number; updatedAt: string | null }> {
  const loaded = await loadHydratedBsplusData(db, userId);
  if (loaded.rowExists) {
    const row = await db
      .prepare("SELECT data FROM bsplus_settings_sync WHERE user_id = ?")
      .bind(userId)
      .first();
    const stored = parseSettingsJson(row ? (row.data as string) : null);
    if (hydrationAddedKeys(stored, loaded.hydrated)) {
      await db
        .prepare("UPDATE bsplus_settings_sync SET data = ? WHERE user_id = ?")
        .bind(JSON.stringify(loaded.hydrated), userId)
        .run();
    }
  }
  return loaded;
}

export function sanitizeBsplusPatch(incoming: Record<string, unknown>): Record<string, unknown> {
  return sanitizeIncomingPatch(incoming, bsplusLocalOnly);
}

export function mergeBsplusPatch(
  hydrated: Record<string, unknown>,
  incoming: Record<string, unknown>,
  themeId?: string,
): { merged: Record<string, unknown>; effectivePatch: Record<string, unknown>; changed: boolean } {
  const sanitized = sanitizeBsplusPatch(incoming);
  const patch: Record<string, unknown> = { ...sanitized };
  if (typeof themeId === "string" && themeId !== "" && !deepEqualTheme(hydrated.selectedTheme, themeId)) {
    patch.selectedTheme = themeId;
  }
  const effectivePatch = pickChangedPatch(hydrated, patch);
  if (Object.keys(effectivePatch).length === 0) {
    return { merged: hydrated, effectivePatch, changed: false };
  }
  const merged = shallowMergePatch(hydrated, effectivePatch);
  return { merged, effectivePatch, changed: true };
}

function deepEqualTheme(stored: unknown, themeId: string): boolean {
  if (typeof stored === "string") return stored.trim() === themeId.trim();
  return false;
}

export async function hashSettingsDocument(doc: Record<string, unknown>): Promise<string> {
  return sha256HexCanonicalJson(doc);
}
