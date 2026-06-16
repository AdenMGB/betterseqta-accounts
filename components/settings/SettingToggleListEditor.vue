<template>
  <div class="space-y-2">
    <div
      v-for="(item, idx) in items"
      :key="idx"
      class="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50"
    >
      <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ item.name }}</span>
      <Switch
        :model-value="item.enabled"
        @update:model-value="(v) => { item.enabled = v; sync() }"
      />
    </div>
    <p v-if="items.length === 0" class="text-sm text-zinc-500 italic">No shortcuts configured.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Switch from '~/components/ui/Switch.vue'

type ToggleItem = { name: string; enabled: boolean }

const props = defineProps<{ modelValue: ToggleItem[] | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: ToggleItem[]] }>()

const items = ref<ToggleItem[]>([])

watch(
  () => props.modelValue,
  (v) => {
    items.value = Array.isArray(v)
      ? v.map((i) => ({ name: i.name ?? '', enabled: !!i.enabled }))
      : []
  },
  { immediate: true, deep: true },
)

function sync() {
  emit('update:modelValue', items.value.map((i) => ({ ...i })))
}
</script>
