<template>
  <div class="space-y-3">
    <div
      v-for="(entry, idx) in entries"
      :key="idx"
      class="flex items-center gap-2"
    >
      <input
        v-model="entry.code"
        type="text"
        class="form-input flex-1 font-mono text-sm"
        placeholder="Subject code"
        @input="sync"
      />
      <Switch v-model="entry.visible" @update:model-value="sync" />
      <span class="text-xs text-zinc-500 w-14">{{ entry.visible ? 'Visible' : 'Hidden' }}</span>
      <button type="button" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" @click="remove(idx)">
        <TrashIcon class="w-4 h-4" />
      </button>
    </div>
    <button type="button" class="text-sm text-primary-500 font-medium flex items-center gap-1" @click="add">
      <PlusIcon class="w-4 h-4" /> Add subject
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import Switch from '~/components/ui/Switch.vue'

type Entry = { code: string; visible: boolean }

const props = defineProps<{ modelValue: Record<string, boolean> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, boolean>] }>()

const entries = ref<Entry[]>([])

watch(
  () => props.modelValue,
  (v) => {
    const obj = v && typeof v === 'object' ? v : {}
    entries.value = Object.entries(obj).map(([code, visible]) => ({ code, visible: visible !== false }))
  },
  { immediate: true, deep: true },
)

function sync() {
  const out: Record<string, boolean> = {}
  for (const e of entries.value) {
    const code = e.code.trim()
    if (!code) continue
    out[code] = e.visible
  }
  emit('update:modelValue', out)
}

function add() {
  entries.value = [...entries.value, { code: '', visible: true }]
}

function remove(idx: number) {
  entries.value = entries.value.filter((_, i) => i !== idx)
  sync()
}
</script>

<style scoped>
.form-input { @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500; }
</style>
