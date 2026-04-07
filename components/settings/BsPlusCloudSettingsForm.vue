<template>
  <CloudSettingsForm
    v-model="model"
    :loading="loading"
    :error="error"
    :success="success"
    :hide-bs-plus-internal-keys="true"
    @save="$emit('save')"
  />
</template>

<script setup lang="ts">
import CloudSettingsForm from '~/components/settings/CloudSettingsForm.vue'

const model = defineModel<Record<string, any>>({ default: () => ({}) })

defineProps<{
  loading?: boolean
  error?: string
  success?: string
}>()

defineEmits<{ save: [] }>()
</script>
