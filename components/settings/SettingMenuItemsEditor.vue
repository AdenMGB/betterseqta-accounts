<template>
  <div class="form-group">
    <label v-if="label" class="form-label">{{ label }}</label>
    <p v-if="description" class="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{{ description }}</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div
        v-for="key in menuKeys"
        :key="key"
        class="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50"
      >
        <span class="text-sm text-zinc-700 dark:text-zinc-300 capitalize">{{ formatKey(key) }}</span>
        <Switch v-model="localItems[key].toggle" @update:model-value="emitUpdate" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Switch from '~/components/ui/Switch.vue'

type MenuItem = { toggle: boolean }
type MenuItems = Record<string, MenuItem>

const MENU_KEYS = [
  'assessments', 'courses', 'dashboard', 'documents', 'forums', 'goals',
  'home', 'messages', 'myed', 'news', 'notices', 'portals', 'reports',
  'settings', 'timetable', 'welcome',
]

const props = defineProps<{
  modelValue: MenuItems | null
  label?: string
  description?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: MenuItems] }>()

const menuKeys = MENU_KEYS
const localItems = ref<MenuItems>({})

watch(
  () => props.modelValue,
  (v) => {
    const base: MenuItems = {}
    for (const key of MENU_KEYS) {
      base[key] = { toggle: v?.[key]?.toggle ?? true }
    }
    localItems.value = base
  },
  { immediate: true, deep: true },
)

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').trim()
}

function emitUpdate() {
  emit('update:modelValue', { ...localItems.value })
}
</script>

<style scoped>
.form-group {
  @apply flex flex-col gap-1.5;
}
.form-label {
  @apply text-sm font-medium text-zinc-700 dark:text-zinc-300;
}
</style>
