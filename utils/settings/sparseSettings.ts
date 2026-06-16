import { isProxy, toRaw } from 'vue'
import type { SettingFieldDef, SettingsSchema } from './types'

const ENVELOPE_KEYS = new Set(['ok', 'server'])

/** Deep-clone plain data; unwraps Vue reactive proxies (structuredClone cannot clone Proxy). */
function unwrapDeep(value: unknown): unknown {
  if (isProxy(value)) value = toRaw(value)
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(unwrapDeep)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = unwrapDeep(v)
  }
  return out
}

export function clonePlain<T>(value: T): T {
  if (value === undefined || value === null) return value
  if (typeof value !== 'object') return value
  return structuredClone(unwrapDeep(value)) as T
}
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => deepEqual(item, b[i]))
  }

  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj).sort()
  const bKeys = Object.keys(bObj).sort()
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => deepEqual(aObj[key], bObj[key]))
}

export function isHiddenKey(key: string, schema: SettingsSchema): boolean {
  if (ENVELOPE_KEYS.has(key)) return true
  if (schema.hiddenKeys?.includes(key)) return true
  if (schema.hiddenKeyPrefixes?.some((prefix) => key.startsWith(prefix))) return true
  const field = schema.fields.find((f) => f.key === key)
  return field?.hidden === true
}

export function getSchemaKeySet(schema: SettingsSchema): Set<string> {
  return new Set(schema.fields.map((f) => f.key))
}

export function getDefaultValue(key: string, schema: SettingsSchema): unknown {
  const field = schema.fields.find((f) => f.key === key)
  return field ? clonePlain(field.defaultValue) : undefined
}

export function sanitizeBaseline(
  raw: Record<string, unknown>,
  schema: SettingsSchema,
): Record<string, unknown> {
  const plain = clonePlain(raw)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(plain)) {
    if (ENVELOPE_KEYS.has(key)) continue
    if (isHiddenKey(key, schema)) continue
    out[key] = value
  }
  return out
}

export function loadDraft(
  baseline: Record<string, unknown>,
  schema: SettingsSchema,
): Record<string, unknown> {
  const draft: Record<string, unknown> = clonePlain(baseline)
  for (const field of schema.fields) {
    if (field.hidden) continue
    if (!(field.key in draft)) {
      draft[field.key] = clonePlain(field.defaultValue)
    }
  }
  return draft
}

export function getUnrecognizedKeys(
  baseline: Record<string, unknown>,
  schema: SettingsSchema,
): string[] {
  const known = getSchemaKeySet(schema)
  return Object.keys(baseline)
    .filter((key) => !known.has(key) && !isHiddenKey(key, schema))
    .sort()
}

export function inferFieldType(key: string, value: unknown): SettingFieldDef['type'] {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) return 'json'
  if (value !== null && typeof value === 'object') return 'json'
  if (key.toLowerCase().match(/(key|password|secret|token)/)) return 'password'
  if (key.toLowerCase().includes('color')) return 'color'
  return 'string'
}

export function buildSparsePatch(
  baseline: Record<string, unknown>,
  draft: Record<string, unknown>,
  schema: SettingsSchema,
  unrecognizedDraft?: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const schemaKeys = getSchemaKeySet(schema)

  for (const field of schema.fields) {
    const key = field.key
    const draftVal = draft[key]
    const baselineVal = baseline[key]
    const defaultVal = field.defaultValue

    if (field.hidden) {
      if (key in baseline && !deepEqual(draftVal, baselineVal)) {
        patch[key] = draftVal
      } else if (!(key in baseline) && key in draft && !deepEqual(draftVal, defaultVal)) {
        patch[key] = draftVal
      }
      continue
    }

    if (!(key in baseline)) {
      if (!deepEqual(draftVal, defaultVal)) {
        patch[key] = draftVal
      }
    } else if (!deepEqual(draftVal, baselineVal)) {
      patch[key] = draftVal
    }
  }

  if (unrecognizedDraft) {
    for (const key of Object.keys(unrecognizedDraft)) {
      if (schemaKeys.has(key) || isHiddenKey(key, schema)) continue
      const draftVal = unrecognizedDraft[key]
      const baselineVal = baseline[key]
      if (!deepEqual(draftVal, baselineVal)) {
        patch[key] = draftVal
      }
    }
  }

  return patch
}

export function extractHiddenKeys(
  raw: Record<string, unknown>,
  schema: SettingsSchema,
): Record<string, unknown> {
  const hidden: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (ENVELOPE_KEYS.has(key)) continue
    if (isHiddenKey(key, schema)) {
      hidden[key] = value
    }
  }
  return hidden
}

function isLocalOnlyKey(key: string, schema: SettingsSchema): boolean {
  if (ENVELOPE_KEYS.has(key)) return true
  if (schema.hiddenKeys?.includes(key)) return true
  if (schema.hiddenKeyPrefixes?.some((prefix) => key.startsWith(prefix))) return true
  return false
}

/** Build schema defaults for every defined field (including UI-hidden syncable keys). */
export function buildSchemaDefaults(schema: SettingsSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of schema.fields) {
    out[field.key] = clonePlain(field.defaultValue)
  }
  return out
}

/**
 * Full cloud upload snapshot: schema defaults → baseline → draft → unrecognized.
 * Local-only keys (hiddenKeys / hiddenKeyPrefixes) are excluded from the payload.
 */
export function buildFullSnapshot(
  baseline: Record<string, unknown>,
  draft: Record<string, unknown>,
  schema: SettingsSchema,
  options?: {
    unrecognizedDraft?: Record<string, unknown>
  },
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...buildSchemaDefaults(schema),
    ...clonePlain(baseline),
    ...clonePlain(draft),
    ...(options?.unrecognizedDraft ? clonePlain(options.unrecognizedDraft) : {}),
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(merged)) {
    if (isLocalOnlyKey(key, schema)) continue
    out[key] = value
  }
  return out
}

/** @deprecated Use buildFullSnapshot */
export function buildBsPlusPayload(
  baseline: Record<string, unknown>,
  draft: Record<string, unknown>,
  schema: SettingsSchema,
  unrecognizedDraft?: Record<string, unknown>,
): Record<string, unknown> {
  return buildFullSnapshot(baseline, draft, schema, { unrecognizedDraft })
}

export function hasFormChanges(
  baseline: Record<string, unknown>,
  draft: Record<string, unknown>,
  schema: SettingsSchema,
  unrecognizedDraft?: Record<string, unknown>,
): boolean {
  return Object.keys(buildSparsePatch(baseline, draft, schema, unrecognizedDraft)).length > 0
}
