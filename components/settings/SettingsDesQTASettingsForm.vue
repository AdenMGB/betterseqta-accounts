<template>
  <SchemaSettingsForm
    class="flex min-h-0 flex-1 flex-col"
    app-id="desqta"
    :schema="desqtaSchema"
    :draft="draft"
    :unrecognized-draft="unrecognizedDraft"
    :unrecognized-keys="unrecognizedKeys"
    :has-changes="hasChanges"
    :loading="loading"
    :error="error"
    :success="success"
    @update:draft="draft = $event"
    @update:unrecognized-draft="unrecognizedDraft = $event"
    @save="$emit('save')"
    @discard="onDiscard"
  />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import SchemaSettingsForm from '~/components/settings/SchemaSettingsForm.vue'
import { useSparseSettingsForm } from '~/composables/useSparseSettingsForm'
import { desqtaSchema } from '~/utils/settings/desqtaSchema'

const props = defineProps<{
  initialData?: Record<string, unknown> | null
  loading?: boolean
  error?: string
  success?: string
}>()

const emit = defineEmits<{ save: []; discard: [] }>()

const {  draft,
  unrecognizedDraft,
  unrecognizedKeys,
  hasChanges,
  loadFromApi,
  buildPayload,
  commitSave,
  discardChanges,
} = useSparseSettingsForm(desqtaSchema, 'sparse')

watch(
  () => props.initialData,
  (data) => {
    if (data) loadFromApi(data)
  },
  { immediate: true },
)

function onDiscard() {
  discardChanges()
  emit('discard')
}

defineExpose({
  loadFromApi,
  buildPayload,
  commitSave,
  discardChanges,
})
</script>
