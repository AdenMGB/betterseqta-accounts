#!/usr/bin/env node
/**
 * Apply D1 migrations locally with idempotent execution.
 * Uses wrangler --file so inline SQL comments are parsed correctly.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CONFIG = {
  database: 'BS_SETTINGS',
  migrationsDir: 'migrations',
  persistTo: '.wrangler/d1-local',
  bootstrapSchema: 'schema.sql',
  skipWhenColumnExists: {
    '0002_oauth_tables.sql': { table: 'users', column: 'is_admin' },
    '0004_admin_levels.sql': { table: 'users', column: 'admin_level' },
    '0016_users_pfp_hash.sql': { table: 'users', column: 'pfp_hash' },
    '0014_oauth_clients_created_by.sql': { table: 'oauth_clients', column: 'created_by' },
    '0019_signup_badges_interop.sql': { table: 'users', column: 'signup_number' },
  },
}

const IGNORE_ERROR = [
  /duplicate column name/i,
  /already exists/i,
  /index .* already exists/i,
]

function wrangler(args) {
  return spawnSync('pnpm', ['exec', 'wrangler', ...args], {
    cwd: root,
    encoding: 'utf-8',
  })
}

function wranglerOut(result) {
  return `${result.stdout || ''}${result.stderr || ''}`
}

function executeFile(filePath) {
  const result = wrangler([
    'd1',
    'execute',
    CONFIG.database,
    '--local',
    `--persist-to=${CONFIG.persistTo}`,
    '--file',
    filePath,
  ])
  const output = wranglerOut(result)
  if (result.status === 0) return { ok: true, output }
  if (IGNORE_ERROR.some((re) => re.test(output))) {
    return { ok: true, ignored: true, output }
  }
  return { ok: false, output }
}

function columnExists(table, column) {
  const result = wrangler([
    'd1',
    'execute',
    CONFIG.database,
    '--local',
    `--persist-to=${CONFIG.persistTo}`,
    '--command',
    `SELECT 1 AS ok FROM pragma_table_info('${table.replace(/'/g, "''")}') WHERE name='${column.replace(/'/g, "''")}' LIMIT 1`,
    '--json',
  ])
  if (result.status !== 0) return false
  try {
    const parsed = JSON.parse(result.stdout || '[]')
    const rows = Array.isArray(parsed) ? parsed[0]?.results ?? parsed : parsed?.results ?? []
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return wranglerOut(result).includes('"ok"')
  }
}

function listMigrationFiles() {
  const dir = path.join(root, CONFIG.migrationsDir)
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

function applyMigrationFile(filename) {
  const skipRule = CONFIG.skipWhenColumnExists[filename]
  if (skipRule && columnExists(skipRule.table, skipRule.column)) {
    console.log(`[skip] ${filename} (${skipRule.table}.${skipRule.column} already exists)`)
    return true
  }

  const filePath = path.join(root, CONFIG.migrationsDir, filename)
  console.log(`[apply] ${filename}`)
  const result = executeFile(filePath)
  if (!result.ok) {
    console.error(`[fail] ${filename}\n${result.output}`)
    return false
  }
  if (result.ignored) {
    console.log(`  [ignored duplicate/already exists]`)
  }
  return true
}

function bootstrapSchema() {
  if (!CONFIG.bootstrapSchema) return
  const schemaPath = path.join(root, CONFIG.bootstrapSchema)
  if (!fs.existsSync(schemaPath)) return
  console.log(`[bootstrap] ${CONFIG.bootstrapSchema}`)
  const result = executeFile(schemaPath)
  if (!result.ok) {
    console.error(`[bootstrap fail]\n${result.output}`)
    process.exit(1)
  }
}

function syncMigrationJournal(files) {
  const ensureTable = wrangler([
    'd1',
    'execute',
    CONFIG.database,
    '--local',
    `--persist-to=${CONFIG.persistTo}`,
    '--command',
    'CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)',
  ])
  if (ensureTable.status !== 0) {
    console.warn('[journal] could not ensure d1_migrations table')
    console.warn(wranglerOut(ensureTable))
    return false
  }

  let synced = 0
  for (const file of files) {
    const escaped = file.replace(/'/g, "''")
    const result = wrangler([
      'd1',
      'execute',
      CONFIG.database,
      '--local',
      `--persist-to=${CONFIG.persistTo}`,
      '--command',
      `INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${escaped}')`,
    ])
    if (result.status === 0) synced++
  }

  console.log(`[journal] recorded ${synced}/${files.length} migrations`)
  return true
}

function main() {
  fs.mkdirSync(path.join(root, CONFIG.persistTo), { recursive: true })
  bootstrapSchema()

  const files = listMigrationFiles()
  if (!files.length) {
    console.error('No migration files found')
    process.exit(1)
  }

  console.log(`Applying ${files.length} migrations to ${CONFIG.database} (local)`)
  for (const file of files) {
    if (!applyMigrationFile(file)) process.exit(1)
  }

  syncMigrationJournal(files)
  console.log('Local migrations complete')
}

main()
