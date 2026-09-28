<template>
  <span
    class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
    :class="STATUS_CLASSES[status] ?? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'"
  >
    {{ status }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ status: string }>()

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/35 dark:text-red-200',
}
</script>
