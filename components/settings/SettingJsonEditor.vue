<template>
  <div class="form-group">
    <label v-if="label" class="form-label">{{ label }}</label>
    <p v-if="description" class="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{{ description }}</p>
    <textarea
      class="form-input font-mono text-sm min-h-[140px] leading-relaxed"
      spellcheck="false"
      :value="text"
      @blur="onBlur"
    />
    <p v-if="parseError" class="text-xs text-red-500 mt-1">{{ parseError }}</p>
    <p v-else class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Edit as JSON. Invalid JSON on blur is reverted.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: unknown
  label?: string
  description?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const text = ref('')
const parseError = ref('')

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return ''
  }
}

watch(
  () => props.modelValue,
  (v) => {
    text.value = stringify(v)
    parseError.value = ''
  },
  { immediate: true },
)

function onBlur(e: Event) {
  const raw = (e.target as HTMLTextAreaElement).value.trim()
  if (raw === '') {
    emit('update:modelValue', null)
    parseError.value = ''
    return
  }
  try {
    const parsed = JSON.parse(raw)
    emit('update:modelValue', parsed)
    parseError.value = ''
  } catch {
    parseError.value = 'Invalid JSON'
    text.value = stringify(props.modelValue)
  }
}
</script>

<style scoped>
.form-group {
  @apply flex flex-col gap-1.5;
}
.form-label {
  @apply text-sm font-medium text-zinc-700 dark:text-zinc-300;
}
.form-input {
  @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200;
}
</style>
