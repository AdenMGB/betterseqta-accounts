/**
 * Idempotent local D1 test user for OAuth / badge / survey dev.
 * Run: pnpm db:seed:test-user [--admin] [--signup-number 42] [--reset]
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";

const PERSIST_TO = ".wrangler/d1-local";
const DB_NAME = "BS_SETTINGS";
/** Senior admin — matches schema (3 = senior, 2 = middle, 1 = junior). */
const SENIOR_ADMIN_LEVEL = 3;

const FOUNDER_BADGE_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000, 2500] as const;

function founderBadgeSql(userId: string, signupNumber: number): string {
  const id = sqlEscape(userId);
  const threshold = FOUNDER_BADGE_THRESHOLDS.find((t) => signupNumber <= t);
  if (!threshold) return "";
  const key = sqlEscape(`founder_${threshold}`);
  return `INSERT OR IGNORE INTO user_badges (user_id, badge_key, awarded_at) VALUES ('${id}', '${key}', unixepoch());`;
}

interface SeedOptions {
  email: string;
  username: string;
  password: string;
  displayName: string;
  admin: boolean;
  signupNumber: number | null;
  reset: boolean;
}

function parseArgs(argv: string[]): SeedOptions {
  const opts: SeedOptions = {
    email: "test@betterseqta.local",
    username: "testuser",
    password: "TestPass123!",
    displayName: "Test User",
    admin: false,
    signupNumber: null,
    reset: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--admin") {
      opts.admin = true;
      continue;
    }
    if (arg === "--reset") {
      opts.reset = true;
      continue;
    }
    if (arg === "--signup-number") {
      const next = argv[++i];
      if (next) opts.signupNumber = Number(next);
      continue;
    }
    if (arg === "--email") {
      const next = argv[++i];
      if (next) opts.email = next;
      continue;
    }
    if (arg === "--username") {
      const next = argv[++i];
      if (next) opts.username = next;
      continue;
    }
    if (arg === "--password") {
      const next = argv[++i];
      if (next) opts.password = next;
      continue;
    }
    if (arg === "--display-name") {
      const next = argv[++i];
      if (next) opts.displayName = next;
      continue;
    }
  }

  return opts;
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function runD1(sql: string): string {
  const dir = mkdtempSync(join(tmpdir(), "bs-seed-"));
  const file = join(dir, "seed.sql");
  writeFileSync(file, sql, "utf8");
  try {
    return execSync(
      `wrangler d1 execute ${DB_NAME} --local --persist-to ${PERSIST_TO} --file "${file}" --json`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function queryScalar(sql: string): string | null {
  try {
    const raw = execSync(
      `wrangler d1 execute ${DB_NAME} --local --persist-to ${PERSIST_TO} --command "${sql.replace(/"/g, '\\"')}" --json`,
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(raw) as Array<{ results?: Array<Record<string, unknown>> }>;
    const row = parsed[0]?.results?.[0];
    if (!row) return null;
    const id = row.id ?? row.ID;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

function deleteUserByEmail(email: string): void {
  const normalized = email.toLowerCase().trim();
  const existingId = queryScalar(
    `SELECT id FROM users WHERE email = '${sqlEscape(normalized)}' LIMIT 1`,
  );
  if (!existingId) {
    console.log(`[seed-test-account] No user to delete for ${normalized}`);
    return;
  }

  const id = sqlEscape(existingId);
  const cleanup = [
    `DELETE FROM user_badges WHERE user_id = '${id}';`,
    `DELETE FROM settings WHERE user_id = '${id}';`,
    `DELETE FROM settings_metadata WHERE user_id = '${id}';`,
    `DELETE FROM bsplus_settings_sync WHERE user_id = '${id}';`,
    `DELETE FROM user_sessions WHERE user_id = '${id}';`,
    `DELETE FROM desqta_sessions WHERE user_id = '${id}';`,
    `DELETE FROM oauth_codes WHERE user_id = '${id}';`,
    `DELETE FROM pfp_history WHERE user_id = '${id}';`,
    `DELETE FROM password_reset_tokens WHERE user_id = '${id}';`,
    `DELETE FROM users WHERE id = '${id}';`,
  ].join("\n");

  runD1(cleanup);
  console.log(`[seed-test-account] Deleted user ${existingId} (${normalized}) and related rows`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const email = opts.email.toLowerCase().trim();
  const username = opts.username.trim();
  const adminLevel = opts.admin ? SENIOR_ADMIN_LEVEL : 0;
  const hash = await bcrypt.hash(opts.password, 10);

  if (opts.reset) {
    deleteUserByEmail(email);
  }

  const existingId = queryScalar(`SELECT id FROM users WHERE email = '${sqlEscape(email)}' LIMIT 1`);

  let userId = existingId ?? crypto.randomUUID();
  const statements: string[] = [];

  if (existingId) {
    statements.push(
      `UPDATE users SET password = '${sqlEscape(hash)}', username = '${sqlEscape(username)}', displayName = '${sqlEscape(opts.displayName)}', admin_level = ${adminLevel} WHERE id = '${sqlEscape(existingId)}';`,
    );
    console.log(`[seed-test-account] Updating existing user ${existingId}`);
  } else {
    statements.push(
      `INSERT INTO users (id, email, password, username, displayName, admin_level) VALUES ('${sqlEscape(userId)}', '${sqlEscape(email)}', '${sqlEscape(hash)}', '${sqlEscape(username)}', '${sqlEscape(opts.displayName)}', ${adminLevel});`,
    );
    console.log(`[seed-test-account] Creating user ${userId}`);
  }

  if (opts.signupNumber != null && Number.isFinite(opts.signupNumber)) {
    statements.push(
      `UPDATE users SET signup_number = ${Math.floor(opts.signupNumber)} WHERE id = '${sqlEscape(userId)}';`,
    );
    statements.push(founderBadgeSql(userId, Math.floor(opts.signupNumber)));
  }

  runD1(statements.join("\n"));

  if (opts.signupNumber != null) {
    console.log(`[seed-test-account] signup_number set to ${opts.signupNumber} (requires migration 0019 if column missing)`);
  }

  const loginUrl = process.env.DEV_ACCOUNTS_URL?.replace(/\/$/, "") || "http://localhost:8788";

  console.log("");
  console.log("Test account ready:");
  console.log(`  Email:        ${email}`);
  console.log(`  Username:     ${username}`);
  console.log(`  Password:     ${opts.password}`);
  console.log(`  Display name: ${opts.displayName}`);
  console.log(
    `  Admin:        ${opts.admin ? `yes (senior admin, admin_level=${SENIOR_ADMIN_LEVEL})` : "no"}`,
  );
  if (opts.signupNumber != null) console.log(`  Signup #:     ${opts.signupNumber}`);
  console.log(`  Login URL:    ${loginUrl}/login`);
  console.log("");
}

main().catch((err) => {
  console.error("[seed-test-account] Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
