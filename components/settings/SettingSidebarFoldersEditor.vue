<template>
  <div class="space-y-3">
    <div
      v-for="(folder, idx) in folders"
      :key="folder.id || idx"
      class="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 space-y-2"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-zinc-500">Folder {{ idx + 1 }}</span>
        <button type="button" class="p-1 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20" @click="remove(idx)">
          <TrashIcon class="w-4 h-4" />
        </button>
      </div>
      <input v-model="folder.name" type="text" class="form-input" placeholder="Folder name" @input="sync" />
      <input v-model="folder.icon" type="text" class="form-input" placeholder="Icon (optional)" @input="sync" />
      <SettingListEditor
        :model-value="folder.items"
        placeholder="/route/path"
        @update:model-value="(v) => { folder.items = v ?? []; sync() }"
      />
      <div class="flex items-center justify-between">
        <span class="text-sm text-zinc-600 dark:text-zinc-400">Collapsed by default</span>
        <Switch v-model="folder.collapsed" @update:model-value="sync" />
      </div>
    </div>
    <button type="button" class="text-sm text-primary-500 font-medium flex items-center gap-1" @click="add">
      <PlusIcon class="w-4 h-4" /> Add folder
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import Switch from '~/components/ui/Switch.vue'
import SettingListEditor from '~/components/settings/SettingListEditor.vue'

type SidebarFolder = {
  id: string
  name: string
  icon?: string
  items: string[]
  collapsed: boolean
  order: number
}

const props = defineProps<{ modelValue: SidebarFolder[] | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: SidebarFolder[] | null] }>()

const folders = ref<SidebarFolder[]>([])

watch(
  () => props.modelValue,
  (v) => {
    folders.value = Array.isArray(v)
      ? v.map((f, i) => ({
          id: f.id ?? crypto.randomUUID(),
          name: f.name ?? '',
          icon: f.icon ?? '',
          items: Array.isArray(f.items) ? [...f.items] : [],
          collapsed: !!f.collapsed,
          order: f.order ?? i,
        }))
      : []
  },
  { immediate: true, deep: true },
)

function sync() {
  const out = folders.value
    .filter((f) => f.name.trim())
    .map((f, i) => ({ ...f, order: i, items: f.items.filter(Boolean) }))
  emit('update:modelValue', out.length ? out : null)
}

function add() {
  folders.value = [
    ...folders.value,
    { id: crypto.randomUUID(), name: '', icon: '', items: [], collapsed: false, order: folders.value.length },
  ]
}

function remove(idx: number) {
  folders.value = folders.value.filter((_, i) => i !== idx)
  sync()
}
</script>

<style scoped>
.form-input { @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500; }
</style>
