<template>
  <span :class="badgeClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CustomThemeStatus } from '~/types/customThemes'

const props = defineProps<{
  status: CustomThemeStatus | string
}>()

const label = computed(() => {
  switch (props.status) {
    case 'pending':
      return 'Pending'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    default:
      return String(props.status)
  }
})

const badgeClass = computed(() => {
  const base = 'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize'
  switch (props.status) {
    case 'pending':
      return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200`
    case 'approved':
      return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200`
    case 'rejected':
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/35 dark:text-red-200`
    default:
      return `${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`
  }
})
</script>
