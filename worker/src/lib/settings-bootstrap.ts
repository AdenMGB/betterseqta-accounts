import { sha256HexCanonicalJson } from "./json-stable";
import {
  hydrateWithDefaults,
  hydrationAddedKeys,
  parseSettingsJson,
} from "./settings-patch";
import { bsplusKnownDefaults, desqtaDefaults } from "../settings/defaults";
import type { Env } from "../types/env";

const HYDRATION_META_KEY = "settings_schema_hydration_version";
const PAGE_SIZE = 50;

let cachedDefaultsVersion: string | null = null;

export async function getSettingsDefaultsVersion(): Promise<string> {
  if (cachedDefaultsVersion) return cachedDefaultsVersion;
  cachedDefaultsVersion = await sha256HexCanonicalJson({
    desqta: desqtaDefaults,
    bsplus: bsplusKnownDefaults,
  });
  return cachedDefaultsVersion;
}

async function readMeta(db: Env["DB"], key: string): Promise<string | null> {
  try {
    const row = await db.prepare("SELECT value FROM system_meta WHERE key = ?").bind(key).first();
    return row ? (row.value as string) : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such table/i.test(msg)) return null;
    throw err;
  }
}

async function writeMeta(db: Env["DB"], key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
}

async function hydrateExistingDesqtaRows(db: Env["DB"]): Promise<number> {
  let updated = 0;
  let offset = 0;
  for (;;) {
    const page = await db
      .prepare("SELECT user_id, data FROM settings ORDER BY user_id LIMIT ? OFFSET ?")
      .bind(PAGE_SIZE, offset)
      .all();
    const rows = (page.results ?? []) as { user_id: string; data: string }[];
    if (rows.length === 0) break;

    const statements: D1PreparedStatement[] = [];
    for (const row of rows) {
      const stored = parseSettingsJson(row.data);
      const hydrated = hydrateWithDefaults(stored, desqtaDefaults);
      if (!hydrationAddedKeys(stored, hydrated)) continue;
      statements.push(
        db.prepare("UPDATE settings SET data = ? WHERE user_id = ?").bind(JSON.stringify(hydrated), row.user_id),
      );
      updated++;
    }
    if (statements.length > 0) await db.batch(statements);

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }
  return updated;
}

async function insertDesqtaDefaultsForUser(db: Env["DB"], userId: string): Promise<boolean> {
  const existing = await db.prepare("SELECT user_id FROM settings WHERE user_id = ?").bind(userId).first();
  if (existing) return false;

  const defaultsJson = JSON.stringify(desqtaDefaults);
  const nowIso = new Date().toISOString();
  const contentHash = await sha256HexCanonicalJson(desqtaDefaults);
  await db.batch([
    db.prepare("INSERT INTO settings (user_id, data) VALUES (?, ?)").bind(userId, defaultsJson),
    db
      .prepare(
        `INSERT OR IGNORE INTO settings_metadata (user_id, settings_revision, settings_updated_at, content_hash)
         VALUES (?, 1, ?, ?)`,
      )
      .bind(userId, nowIso, contentHash),
  ]);
  return true;
}

/** Ensure a single user has a full DesQTA settings row (e.g. after registration). */
export async function ensureUserDesqtaSettings(db: Env["DB"], userId: string): Promise<void> {
  await insertDesqtaDefaultsForUser(db, userId);
}

async function createMissingDesqtaRowsForUsers(db: Env["DB"]): Promise<number> {
  let created = 0;
  let offset = 0;

  for (;;) {
    const page = await db
      .prepare(
        `SELECT u.id AS user_id FROM users u
         LEFT JOIN settings s ON s.user_id = u.id
         WHERE s.user_id IS NULL
         ORDER BY u.id
         LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, offset)
      .all();
    const rows = (page.results ?? []) as { user_id: string }[];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (await insertDesqtaDefaultsForUser(db, row.user_id)) created++;
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }
  return created;
}

async function ensureDesqtaMetadataForSettingsRows(db: Env["DB"]): Promise<number> {
  let repaired = 0;
  const page = await db
    .prepare(
      `SELECT s.user_id, s.data FROM settings s
       LEFT JOIN settings_metadata m ON m.user_id = s.user_id
       WHERE m.user_id IS NULL`,
    )
    .all();
  const rows = (page.results ?? []) as { user_id: string; data: string }[];
  if (rows.length === 0) return 0;

  const nowIso = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const row of rows) {
    const stored = parseSettingsJson(row.data);
    const hydrated = hydrateWithDefaults(stored, desqtaDefaults);
    const hash = await sha256HexCanonicalJson(hydrated);
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO settings_metadata (user_id, settings_revision, settings_updated_at, content_hash)
           VALUES (?, 1, ?, ?)`,
        )
        .bind(row.user_id, nowIso, hash),
    );
    repaired++;
  }
  if (statements.length > 0) await db.batch(statements);
  return repaired;
}

async function hydrateExistingBsplusRows(db: Env["DB"]): Promise<number> {
  let updated = 0;
  let offset = 0;
  for (;;) {
    const page = await db
      .prepare("SELECT user_id, data FROM bsplus_settings_sync ORDER BY user_id LIMIT ? OFFSET ?")
      .bind(PAGE_SIZE, offset)
      .all();
    const rows = (page.results ?? []) as { user_id: string; data: string }[];
    if (rows.length === 0) break;

    const statements: D1PreparedStatement[] = [];
    for (const row of rows) {
      const stored = parseSettingsJson(row.data);
      const hydrated = hydrateWithDefaults(stored, bsplusKnownDefaults);
      if (!hydrationAddedKeys(stored, hydrated)) continue;
      statements.push(
        db
          .prepare("UPDATE bsplus_settings_sync SET data = ? WHERE user_id = ?")
          .bind(JSON.stringify(hydrated), row.user_id),
      );
      updated++;
    }
    if (statements.length > 0) await db.batch(statements);

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }
  return updated;
}

/** Full settings schema backfill — idempotent, safe to re-run when defaults version changes. */
export async function runSettingsBootstrap(db: Env["DB"]): Promise<{
  desqtaHydrated: number;
  desqtaCreated: number;
  desqtaMetadataRepaired: number;
  bsplusHydrated: number;
}> {
  const desqtaHydrated = await hydrateExistingDesqtaRows(db);
  const desqtaCreated = await createMissingDesqtaRowsForUsers(db);
  const desqtaMetadataRepaired = await ensureDesqtaMetadataForSettingsRows(db);
  const bsplusHydrated = await hydrateExistingBsplusRows(db);
  return { desqtaHydrated, desqtaCreated, desqtaMetadataRepaired, bsplusHydrated };
}

let bootstrapInFlight: Promise<void> | null = null;

/**
 * Runs once per deployed defaults schema version (tracked in D1 system_meta).
 * Triggered automatically from the worker fetch handler via waitUntil.
 */
export async function runSettingsBootstrapIfNeeded(env: Env): Promise<void> {
  if (bootstrapInFlight) {
    await bootstrapInFlight;
    return;
  }

  bootstrapInFlight = (async () => {
    const targetVersion = await getSettingsDefaultsVersion();
    const currentVersion = await readMeta(env.DB, HYDRATION_META_KEY);
    if (currentVersion === targetVersion) return;

    const stats = await runSettingsBootstrap(env.DB);
    try {
      await writeMeta(env.DB, HYDRATION_META_KEY, targetVersion);
    } catch (err) {
      console.error("[settings-bootstrap] could not persist version (run D1 migrations?)", err);
    }
    console.log("[settings-bootstrap] completed", { targetVersion, ...stats });
  })();

  try {
    await bootstrapInFlight;
  } finally {
    bootstrapInFlight = null;
  }
}
