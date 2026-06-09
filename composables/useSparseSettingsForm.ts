import { ref, computed } from 'vue'
import type { SettingsSchema } from '~/utils/settings/types'
import {
  buildFullSnapshot,
  buildSparsePatch,
  clonePlain,
  extractHiddenKeys,
  getUnrecognizedKeys,
  hasFormChanges,
  loadDraft,
  sanitizeBaseline,
} from '~/utils/settings/sparseSettings'

export type SparseSaveMode = 'sparse' | 'full'

export function useSparseSettingsForm(schema: SettingsSchema, saveMode: SparseSaveMode = 'sparse') {
  const baseline = ref<Record<string, unknown>>({})
  const hiddenBaseline = ref<Record<string, unknown>>({})
  const draft = ref<Record<string, unknown>>({})
  const unrecognizedDraft = ref<Record<string, unknown>>({})

  const unrecognizedKeys = computed(() => getUnrecognizedKeys(baseline.value, schema))

  const hasChanges = computed(() =>
    hasFormChanges(baseline.value, draft.value, schema, unrecognizedDraft.value),
  )

  function loadFromApi(data: Record<string, unknown>) {
    const raw = clonePlain(data ?? {})
    hiddenBaseline.value = clonePlain(extractHiddenKeys(raw, schema))
    const clean = sanitizeBaseline(raw, schema)
    baseline.value = clonePlain(clean)

    const unrecognized: Record<string, unknown> = {}
    for (const key of getUnrecognizedKeys(clean, schema)) {
      unrecognized[key] = clean[key]
    }
    unrecognizedDraft.value = clonePlain(unrecognized)

    draft.value = loadDraft(clean, schema)
  }

  function buildPayload(): Record<string, unknown> {
    if (saveMode === 'full') {
      return buildFullSnapshot(
        baseline.value,
        draft.value,
        schema,
        { unrecognizedDraft: unrecognizedDraft.value },
      )
    }
    return buildSparsePatch(
      baseline.value,
      draft.value,
      schema,
      unrecognizedDraft.value,
    )
  }

  function commitSave(patch?: Record<string, unknown>) {
    const applied = patch ?? buildPayload()

    if (saveMode === 'full') {
      const plainApplied = clonePlain(applied)
      hiddenBaseline.value = clonePlain(extractHiddenKeys(plainApplied, schema))
      const clean = sanitizeBaseline(plainApplied, schema)
      baseline.value = clonePlain(clean)
      draft.value = loadDraft(clean, schema)
      const unrecognized: Record<string, unknown> = {}
      for (const key of getUnrecognizedKeys(clean, schema)) {
        unrecognized[key] = clean[key]
      }
      unrecognizedDraft.value = clonePlain(unrecognized)
      return
    }

    const next = clonePlain({ ...baseline.value, ...applied })
    baseline.value = next
    draft.value = loadDraft(next, schema)

    const unrecognized: Record<string, unknown> = {}
    for (const key of getUnrecognizedKeys(next, schema)) {
      unrecognized[key] = next[key]
    }
    unrecognizedDraft.value = clonePlain(unrecognized)
  }

  function discardChanges() {
    draft.value = loadDraft(baseline.value, schema)
    const unrecognized: Record<string, unknown> = {}
    for (const key of getUnrecognizedKeys(baseline.value, schema)) {
      unrecognized[key] = baseline.value[key]
    }
    unrecognizedDraft.value = clonePlain(unrecognized)
  }

  function setDraftValue(key: string, value: unknown) {
    draft.value = clonePlain({ ...draft.value, [key]: value })
  }

  function setUnrecognizedValue(key: string, value: unknown) {
    unrecognizedDraft.value = clonePlain({ ...unrecognizedDraft.value, [key]: value })
  }

  return {
    baseline,
    draft,
    unrecognizedDraft,
    unrecognizedKeys,
    hasChanges,
    loadFromApi,
    buildPayload,
    commitSave,
    discardChanges,
    setDraftValue,
    setUnrecognizedValue,
  }
}
