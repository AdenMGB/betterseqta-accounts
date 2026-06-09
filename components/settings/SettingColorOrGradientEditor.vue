<template>
  <div class="space-y-3">
    <ColorPicker
      :model-value="solidHex"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="isGradient" class="text-xs text-amber-600 dark:text-amber-400">
      Currently a gradient from the extension. Pick a solid colour above to replace it.
    </p>
    <div
      class="h-10 rounded-lg border border-zinc-300 dark:border-zinc-600"
      :style="{ background: previewBackground }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ColorPicker from '~/components/ui/ColorPicker.vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const isGradient = computed(() => /gradient/i.test(props.modelValue ?? ''))

const solidHex = computed(() => {
  const v = props.modelValue ?? ''
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  return '#3b82f6'
})

const previewBackground = computed(() => props.modelValue || '#3b82f6')
</script>
