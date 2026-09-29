/**
 * Local Cloudflare dev entrypoint (Windows-safe). Sets CF_DEV for Nuxt generate and service probing.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, CF_DEV: '1' }

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('node', ['scripts/resolve-dev-services.mjs'])
run('node', ['scripts/sync-dev-vars.mjs'])
run('pnpm', ['generate'])
run('pnpm', ['exec', 'wrangler', 'dev', '--local', '--persist-to', '.wrangler/d1-local', '--env-file', '.dev.vars'])
