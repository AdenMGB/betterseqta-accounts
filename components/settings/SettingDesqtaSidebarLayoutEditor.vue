<template>
  <div class="space-y-3">
    <p class="text-xs text-zinc-500 dark:text-zinc-400">Drag to reorder sidebar pages. Toggle to show or hide each route.</p>

    <div class="space-y-2">
      <div
        v-for="(entry, idx) in orderedEntries"
        :key="entry.id"
        draggable="true"
        class="flex items-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing"
        :class="dragOverIndex === idx ? 'ring-2 ring-primary-500' : ''"
        @dragstart="onDragStart(idx)"
        @dragover.prevent="dragOverIndex = idx"
        @dragleave="dragOverIndex = null"
        @drop.prevent="onDrop(idx)"
        @dragend="onDragEnd"
      >
        <Bars3Icon class="w-4 h-4 shrink-0 text-zinc-400" />
        <div class="flex-1 min-w-0">
          <span class="text-sm text-zinc-700 dark:text-zinc-300 block truncate">{{ entry.label }}</span>
          <span v-if="entry.kind === 'folder'" class="text-xs text-zinc-500 font-mono">{{ entry.id }}</span>
        </div>
        <Switch
          v-if="entry.kind === 'route'"
          :model-value="entry.enabled"
          @update:model-value="(v) => setRouteEnabled(entry.id, v)"
        />
        <span v-else class="text-xs text-zinc-400 w-14 text-right">Folder</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Bars3Icon } from '@heroicons/vue/24/outline'
import Switch from '~/components/ui/Switch.vue'

const DEFAULT_ROUTES = [
  '/',
  '/dashboard',
  '/courses',
  '/assessments',
  '/timetable',
  '/messages',
  '/notices',
  '/news',
  '/documents',
  '/forums',
  '/goals',
  '/portals',
  '/reports',
  '/myed',
  '/welcome',
  '/settings',
] as const

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/courses': 'Courses',
  '/assessments': 'Assessments',
  '/timetable': 'Timetable',
  '/messages': 'Messages',
  '/notices': 'Notices',
  '/news': 'News',
  '/documents': 'Documents',
  '/forums': 'Forums',
  '/goals': 'Goals',
  '/portals': 'Portals',
  '/reports': 'Reports',
  '/myed': 'MyEd',
  '/welcome': 'Welcome',
  '/settings': 'Settings',
}

type SidebarFolder = { id: string; name: string }

const props = defineProps<{
  menuOrder: string[] | null
  disabledPages: string[] | null
  folders: SidebarFolder[] | null
}>()

const emit = defineEmits<{
  'update:menuOrder': [value: string[]]
  'update:disabledPages': [value: string[] | null]
}>()

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const localOrder = ref<string[]>([])
const localDisabled = ref<Set<string>>(new Set())

watch(
  () => [props.menuOrder, props.disabledPages, props.folders] as const,
  () => syncFromProps(),
  { immediate: true, deep: true },
)

function syncFromProps() {
  const disabled = new Set(Array.isArray(props.disabledPages) ? props.disabledPages : [])
  localDisabled.value = disabled

  const folderIds = new Set(
    (Array.isArray(props.folders) ? props.folders : []).map((f) => `folder:${f.id}`),
  )

  const saved = Array.isArray(props.menuOrder) ? [...props.menuOrder] : []
  const knownRoutes = DEFAULT_ROUTES.filter((r) => !saved.includes(r))
  const knownFolders = [...folderIds].filter((f) => !saved.includes(f))

  localOrder.value = saved.length
    ? [...saved, ...knownRoutes.filter((r) => !saved.includes(r)), ...knownFolders.filter((f) => !saved.includes(f))]
    : [...DEFAULT_ROUTES, ...folderIds]
}

const orderedEntries = computed(() =>
  localOrder.value.map((id) => {
    if (id.startsWith('folder:')) {
      const folderId = id.slice('folder:'.length)
      const folder = (props.folders ?? []).find((f) => f.id === folderId)
      return {
        id,
        label: folder?.name ?? 'Folder',
        kind: 'folder' as const,
        enabled: true,
      }
    }
    return {
      id,
      label: ROUTE_LABELS[id] ?? id,
      kind: 'route' as const,
      enabled: !localDisabled.value.has(id),
    }
  }),
)

function emitAll() {
  emit('update:menuOrder', [...localOrder.value])
  const disabled = [...localDisabled.value].filter((r) => r !== '/settings')
  emit('update:disabledPages', disabled.length ? disabled : null)
}

function setRouteEnabled(route: string, enabled: boolean) {
  if (route === '/settings') return
  const next = new Set(localDisabled.value)
  if (enabled) next.delete(route)
  else next.add(route)
  localDisabled.value = next
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
