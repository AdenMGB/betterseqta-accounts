/**
 * Exports syncable schema defaults for the Cloudflare worker.
 * Run: pnpm export:settings-defaults
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { desqtaSchema } from "../utils/settings/desqtaSchema.ts";
import { bsplusSchema } from "../utils/settings/bsplusSchema.ts";
import type { SettingsSchema } from "../utils/settings/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../worker/src/settings");

function isLocalOnlyKey(key: string, schema: SettingsSchema): boolean {
  if (schema.hiddenKeys?.includes(key)) return true;
  if (schema.hiddenKeyPrefixes?.some((prefix) => key.startsWith(prefix))) return true;
  return false;
}

function buildSyncableDefaults(schema: SettingsSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (isLocalOnlyKey(field.key, schema)) continue;
    out[field.key] = structuredClone(field.defaultValue);
  }
  return out;
}

mkdirSync(outDir, { recursive: true });

const desqtaDefaults = buildSyncableDefaults(desqtaSchema);
const bsplusDefaults = buildSyncableDefaults(bsplusSchema);

writeFileSync(join(outDir, "desqta-defaults.json"), JSON.stringify(desqtaDefaults, null, 2) + "\n");
writeFileSync(join(outDir, "bsplus-known-defaults.json"), JSON.stringify(bsplusDefaults, null, 2) + "\n");

console.log(`Wrote ${Object.keys(desqtaDefaults).length} DesQTA defaults`);
console.log(`Wrote ${Object.keys(bsplusDefaults).length} BS+ known defaults`);
