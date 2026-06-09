<template>
  <div class="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
    <template v-for="sub in subFields" :key="sub.key">
      <div
        v-if="sub.type === 'boolean'"
        class="flex items-center justify-between gap-3"
      >
        <div>
          <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ sub.label }}</span>
          <p v-if="sub.description" class="text-xs text-zinc-500 dark:text-zinc-400">{{ sub.description }}</p>
        </div>
        <Switch
          :model-value="!!localValue[sub.key]"
          :invert="sub.invert"
          @update:model-value="setSub(sub.key, $event)"
        />
      </div>

      <div v-else-if="sub.type === 'enum'" class="form-group">
        <label class="form-label">{{ sub.label }}</label>
        <select
          :value="String(localValue[sub.key] ?? '')"
          class="form-select"
          @change="setSub(sub.key, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in sub.enumOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div v-else-if="sub.type === 'color'" class="form-group">
        <label class="form-label">{{ sub.label }}</label>
        <ColorPicker
          :model-value="String(localValue[sub.key] ?? '#3b82f6')"
          @update:model-value="setSub(sub.key, $event)"
        />
      </div>

      <div v-else-if="sub.type === 'number'" class="form-group">
        <label class="form-label">{{ sub.label }}</label>
        <div v-if="sub.min != null && sub.max != null" class="flex items-center gap-3">
          <input
            type="range"
            :value="Number(localValue[sub.key] ?? sub.min)"
            :min="sub.min"
            :max="sub.max"
            :step="sub.step ?? 0.01"
            class="flex-1 accent-primary-500"
            @input="setSub(sub.key, Number(($event.target as HTMLInputElement).value))"
          />
          <span class="text-sm font-mono text-zinc-600 dark:text-zinc-400 w-12 text-right">
            {{ formatNumber(localValue[sub.key], sub) }}
          </span>
        </div>
        <input
          v-else
          type="number"
          :value="localValue[sub.key] ?? ''"
          :min="sub.min"
          :max="sub.max"
          :step="sub.step ?? 'any'"
          class="form-input"
          @input="setSub(sub.key, parseNumber(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div v-else-if="sub.type === 'month'" class="form-group">
        <label class="form-label">{{ sub.label }}</label>
        <input
          type="month"
          :value="String(localValue[sub.key] ?? '')"
          class="form-input"
          @input="setSub(sub.key, ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div v-else-if="sub.type === 'hotkey'" class="form-group">
        <label class="form-label">{{ sub.label }}</label>
        <select
          :value="String(localValue[sub.key] ?? '')"
          class="form-select"
          @change="setSub(sub.key, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in HOTKEY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div v-else class="form-group">
        <label class="form-label">{{ sub.label }}</label>
        <input
          type="text"
          :value="String(localValue[sub.key] ?? '')"
          class="form-input"
          @input="setSub(sub.key, ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SettingSubFieldDef } from '~/utils/settings/types'
import Switch from '~/components/ui/Switch.vue'
import ColorPicker from '~/components/ui/ColorPicker.vue'

const HOTKEY_OPTIONS = [
  { value: 'ctrl+k', label: 'Ctrl + K' },
  { value: 'ctrl+/', label: 'Ctrl + /' },
  { value: 'ctrl+shift+f', label: 'Ctrl + Shift + F' },
  { value: 'alt+k', label: 'Alt + K' },
]

const props = defineProps<{
  modelValue: Record<string, unknown> | null
  subFields: SettingSubFieldDef[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()

const localValue = ref<Record<string, unknown>>({})

watch(
  () => props.modelValue,
  (v) => {
    localValue.value = { ...(v && typeof v === 'object' ? v : {}) }
  },
  { immediate: true, deep: true },
)

function setSub(key: string, value: unknown) {
  localValue.value = { ...localValue.value, [key]: value }
  emit('update:modelValue', { ...localValue.value })
}

function parseNumber(raw: string) {
  if (raw === '') return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function formatNumber(value: unknown, sub: SettingSubFieldDef) {
  const n = Number(value ?? sub.min ?? 0)
  if (sub.step != null && sub.step < 1) return n.toFixed(2)
  return String(n)
}
</script>

<style scoped>
.form-group { @apply flex flex-col gap-1.5; }
.form-label { @apply text-sm font-medium text-zinc-700 dark:text-zinc-300; }
.form-input { @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500; }
.form-select { @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[2.5rem]; }
</style>
