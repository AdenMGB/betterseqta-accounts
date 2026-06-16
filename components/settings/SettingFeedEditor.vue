<template>
  <div class="form-group">
    <label v-if="label" class="form-label">{{ label }}</label>
    <p v-if="description" class="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{{ description }}</p>

    <div v-if="items.length === 0" class="text-sm text-zinc-500 dark:text-zinc-400 italic mb-2">
      No feeds. Add one below.
    </div>

    <div v-for="(item, idx) in items" :key="idx" class="flex items-center gap-2 mb-2">
      <input
        v-model="item.url"
        type="url"
        class="form-input flex-1"
        placeholder="https://example.com/feed.xml"
        @input="sync"
      />
      <button
        type="button"
        class="shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
        @click="remove(idx)"
      >
        <TrashIcon class="w-4 h-4" />
      </button>
    </div>

    <button
      type="button"
      class="text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
      @click="add"
    >
      <PlusIcon class="w-4 h-4" />
      Add feed
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'

type Feed = { url: string }

const props = defineProps<{
  modelValue: Feed[] | null
  label?: string
  description?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Feed[]] }>()

const items = ref<Feed[]>([])

watch(
  () => props.modelValue,
  (v) => {
    items.value = Array.isArray(v) ? v.map((f) => ({ url: f.url ?? '' })) : []
  },
  { immediate: true, deep: true },
)

function sync() {
  emit('update:modelValue', items.value.filter((f) => f.url.trim()))
}

function add() {
  items.value = [...items.value, { url: '' }]
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
