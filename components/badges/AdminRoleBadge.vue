<template>
  <span
    :class="badgeClass"
    class="admin-badge inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold leading-none tracking-wide ring-1 ring-inset transition-all duration-200"
    :title="title"
  >
    <ShieldCheckIcon class="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ShieldCheckIcon } from '@heroicons/vue/20/solid'

const props = defineProps<{
  level: number
}>()

const label = computed(() => {
  const level = props.level
  if (level <= 0) return ''
  if (level >= 3) return 'Senior Admin'
  if (level === 2) return 'Middle Admin'
  if (level === 1) return 'Junior Admin'
  return `Level ${level} Admin`
})

const badgeClass = computed(() => {
  const level = props.level
  if (level >= 3) {
    return 'bg-amber-500/12 text-amber-800 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30'
  }
  if (level >= 2) {
    return 'bg-primary-500/12 text-primary-700 ring-primary-500/25 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-400/30'
  }
  if (level >= 1) {
    return 'bg-sky-500/10 text-sky-800 ring-sky-500/20 dark:bg-sky-500/12 dark:text-sky-200 dark:ring-sky-400/25'
  }
  return ''
})

const title = computed(() => `${label.value} — BetterSEQTA Cloud staff`)
</script>
