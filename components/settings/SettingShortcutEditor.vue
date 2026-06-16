<template>
  <div class="form-group">
    <label v-if="label" class="form-label">{{ label }}</label>
    <p v-if="description" class="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{{ description }}</p>

    <div v-if="items.length === 0" class="text-sm text-zinc-500 dark:text-zinc-400 italic mb-2">
      No shortcuts. Add one below.
    </div>

    <div
      v-for="(item, idx) in items"
      :key="idx"
      class="p-3 mb-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 space-y-2"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-zinc-500">Shortcut {{ idx + 1 }}</span>
        <button
          type="button"
          class="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          @click="remove(idx)"
        >
          <TrashIcon class="w-4 h-4" />
        </button>
      </div>
      <input v-model="item.name" type="text" class="form-input" placeholder="Name" @input="sync" />
      <input v-model="item.icon" type="text" class="form-input" placeholder="Icon (emoji or text)" @input="sync" />
      <input v-model="item.url" type="url" class="form-input" placeholder="https://..." @input="sync" />
    </div>

    <button
      type="button"
      class="text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
      @click="add"
    >
      <PlusIcon class="w-4 h-4" />
      Add shortcut
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'

type Shortcut = { name: string; icon: string; url: string }

const props = defineProps<{
  modelValue: Shortcut[] | null
  label?: string
  description?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Shortcut[]] }>()

const items = ref<Shortcut[]>([])

watch(
  () => props.modelValue,
  (v) => {
    items.value = Array.isArray(v)
      ? v.map((s) => ({ name: s.name ?? '', icon: s.icon ?? '', url: s.url ?? '' }))
      : []
  },
  { immediate: true, deep: true },
)

function sync() {
  emit('update:modelValue', items.value.filter((s) => s.name || s.url))
}

function add() {
  items.value = [...items.value, { name: '', icon: '', url: '' }]
}

function remove(idx: number) {
  items.value = items.value.filter((_, i) => i !== idx)
  sync()
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
