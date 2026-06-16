<template>
  <div class="space-y-3">
    <div
      v-for="(folder, idx) in folders"
      :key="folder.id || idx"
      class="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 space-y-2"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-zinc-500">Folder {{ idx + 1 }}</span>
        <button type="button" class="p-1 text-red-500 rounded" @click="remove(idx)">
          <TrashIcon class="w-4 h-4" />
        </button>
      </div>
      <input v-model="folder.name" type="text" class="form-input" placeholder="Name" @input="sync" />
      <div class="flex gap-2">
        <input v-model="folder.emoji" type="text" class="form-input w-16 text-center" placeholder="📁" maxlength="4" @input="sync" />
        <input v-model="folder.color" type="color" class="h-10 w-14 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer" @input="sync" />
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

type MessageFolder = { id: string; name: string; color: string; emoji: string }

const props = defineProps<{ modelValue: MessageFolder[] | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: MessageFolder[]] }>()

const folders = ref<MessageFolder[]>([])

watch(
  () => props.modelValue,
  (v) => {
    folders.value = Array.isArray(v)
      ? v.map((f) => ({
          id: f.id ?? crypto.randomUUID(),
          name: f.name ?? '',
          color: f.color ?? '#3b82f6',
          emoji: f.emoji ?? '📁',
        }))
      : []
  },
  { immediate: true, deep: true },
)

function sync() {
  emit('update:modelValue', folders.value.filter((f) => f.name.trim()))
}

function add() {
  folders.value = [...folders.value, { id: crypto.randomUUID(), name: '', color: '#3b82f6', emoji: '📁' }]
}

function remove(idx: number) {
  folders.value = folders.value.filter((_, i) => i !== idx)
  sync()
}
</script>

<style scoped>
.form-input { @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500; }
</style>
