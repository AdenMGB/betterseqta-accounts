<template>
  <div class="space-y-3">
    <p v-if="description" class="text-xs text-zinc-500 dark:text-zinc-400">{{ description }}</p>
    <p class="text-xs text-zinc-500 dark:text-zinc-400">Drag to reorder. Toggle to show or hide each item in the sidebar.</p>

    <div class="space-y-2">
      <div
        v-for="(entry, idx) in orderedEntries"
        :key="entry.key"
        draggable="true"
        class="flex items-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing transition-shadow"
        :class="dragOverIndex === idx ? 'ring-2 ring-primary-500' : ''"
        @dragstart="onDragStart(idx)"
        @dragover.prevent="dragOverIndex = idx"
        @dragleave="dragOverIndex = null"
        @drop.prevent="onDrop(idx)"
        @dragend="onDragEnd"
      >
        <Bars3Icon class="w-4 h-4 shrink-0 text-zinc-400" />
        <span class="text-sm text-zinc-700 dark:text-zinc-300 flex-1 capitalize">{{ entry.label }}</span>
        <Switch
          :model-value="entry.enabled"
          @update:model-value="(v) => setEnabled(entry.key, v)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Bars3Icon } from '@heroicons/vue/24/outline'
import Switch from '~/components/ui/Switch.vue'

const MENU_KEYS = [
  'assessments', 'courses', 'dashboard', 'documents', 'forums', 'goals',
  'home', 'messages', 'myed', 'news', 'notices', 'portals', 'reports',
  'settings', 'timetable', 'welcome',
] as const

type MenuItem = { toggle: boolean }
type MenuItems = Record<string, MenuItem>

const props = defineProps<{
  menuItems: MenuItems | null
  menuOrder: string[] | null
  label?: string
  description?: string
}>()

const emit = defineEmits<{
  'update:menuItems': [value: MenuItems]
  'update:menuOrder': [value: string[]]
}>()

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const localItems = ref<MenuItems>({})
const localOrder = ref<string[]>([])

watch(
  () => [props.menuItems, props.menuOrder] as const,
  () => syncFromProps(),
  { immediate: true, deep: true },
)

function syncFromProps() {
  const items: MenuItems = {}
  for (const key of MENU_KEYS) {
    items[key] = { toggle: props.menuItems?.[key]?.toggle ?? true }
  }
  localItems.value = items

  const saved = Array.isArray(props.menuOrder) ? props.menuOrder.filter((k) => MENU_KEYS.includes(k as any)) : []
  const missing = MENU_KEYS.filter((k) => !saved.includes(k))
  localOrder.value = saved.length ? [...saved, ...missing] : [...MENU_KEYS]
}

const orderedEntries = computed(() =>
  localOrder.value.map((key) => ({
    key,
    label: formatKey(key),
    enabled: localItems.value[key]?.toggle ?? true,
  })),
)

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').trim()
}

function emitAll() {
  emit('update:menuItems', { ...localItems.value })
  emit('update:menuOrder', [...localOrder.value])
}

function setEnabled(key: string, enabled: boolean) {
  localItems.value = {
    ...localItems.value,
    [key]: { toggle: enabled },
  }
  emitAll()
}

function onDragStart(idx: number) {
  dragIndex.value = idx
}

function onDrop(targetIdx: number) {
  if (dragIndex.value == null || dragIndex.value === targetIdx) return
  const next = [...localOrder.value]
  const [moved] = next.splice(dragIndex.value, 1)
  next.splice(targetIdx, 0, moved)
  localOrder.value = next
  dragIndex.value = null
  dragOverIndex.value = null
  emitAll()
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}
</script>
