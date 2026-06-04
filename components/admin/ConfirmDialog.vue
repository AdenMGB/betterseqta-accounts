<template>
  <Modal :is-open="open" @close="$emit('cancel')">
    <template #header>{{ title }}</template>
    <template #body>
      <p class="text-sm leading-relaxed">{{ message }}</p>
    </template>
    <template #footer>
      <button
        type="button"
        class="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="button"
        :class="destructive
          ? 'px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors'
          : 'px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors'"
        @click="$emit('confirm')"
      >
        {{ confirmLabel }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '~/components/ui/Modal.vue'

defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
}>()

defineEmits<{ cancel: []; confirm: [] }>()
</script>
