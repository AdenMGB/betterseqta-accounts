import type { Env } from "../types/env";

const SMTP2GO_API_KEY_META = "integration_smtp2go_api_key";
const SMTP2GO_FROM_EMAIL_META = "integration_smtp2go_from_email";

async function readMeta(db: Env["DB"], key: string): Promise<string | null> {
  try {
    const row = await db.prepare("SELECT value FROM system_meta WHERE key = ?").bind(key).first<{ value: string }>();
    return row?.value ? String(row.value).trim() : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such table/i.test(msg)) return null;
    throw err;
  }
}

async function writeMeta(db: Env["DB"], key: string, value: string | null): Promise<void> {
  const now = new Date().toISOString();
  if (!value) {
    await db.prepare("DELETE FROM system_meta WHERE key = ?").bind(key).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
}

export interface IntegrationSettingsPublic {
  hasSmtp2goApiKey: boolean;
  smtp2goFromEmail: string;
  devAccountsUrl: string;
}

export async function getIntegrationSettingsPublic(env: Env): Promise<IntegrationSettingsPublic> {
  const fromMeta = await readMeta(env.DB, SMTP2GO_FROM_EMAIL_META);
  const apiKeyMeta = await readMeta(env.DB, SMTP2GO_API_KEY_META);
  const devAccountsUrl = String(env.DEV_ACCOUNTS_URL || env.APP_URL || "http://localhost:8788").replace(/\/$/, "");

  return {
    hasSmtp2goApiKey: Boolean(apiKeyMeta || env.SMTP2GO_API_KEY),
    smtp2goFromEmail: fromMeta || env.SMTP2GO_FROM_EMAIL || "",
    devAccountsUrl,
  };
}

export async function getSmtp2goCredentials(env: Env): Promise<{ apiKey: string; fromEmail: string }> {
  const apiKeyMeta = await readMeta(env.DB, SMTP2GO_API_KEY_META);
  const fromMeta = await readMeta(env.DB, SMTP2GO_FROM_EMAIL_META);

  return {
    apiKey: String(apiKeyMeta || env.SMTP2GO_API_KEY || "").trim(),
    fromEmail: String(fromMeta || env.SMTP2GO_FROM_EMAIL || "noreply@betterseqta.org").trim(),
  };
}

export async function saveIntegrationSettings(
  env: Env,
  input: { smtp2goApiKey?: string; smtp2goFromEmail?: string },
): Promise<void> {
  if (input.smtp2goApiKey !== undefined) {
    const trimmed = String(input.smtp2goApiKey).trim();
    if (trimmed) {
      await writeMeta(env.DB, SMTP2GO_API_KEY_META, trimmed);
    } else {
      await writeMeta(env.DB, SMTP2GO_API_KEY_META, null);
    }
  }

  if (input.smtp2goFromEmail !== undefined) {
    const trimmed = String(input.smtp2goFromEmail).trim();
    if (trimmed) {
      await writeMeta(env.DB, SMTP2GO_FROM_EMAIL_META, trimmed);
    } else {
      await writeMeta(env.DB, SMTP2GO_FROM_EMAIL_META, null);
    }
  }
}
