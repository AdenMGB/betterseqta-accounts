<template>
  <div class="space-y-4">
    <div
      class="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-200"
      :class="isDragging ? 'border-primary-500 bg-primary-500/10' : 'border-zinc-300 bg-zinc-50/50 dark:border-zinc-600 dark:bg-zinc-950/20'"
      @click="fileInput?.click()"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept=".zip,application/zip" class="hidden" @change="onFileSelect" />
      <ArrowUpTrayIcon class="mx-auto mb-3 h-10 w-10 text-zinc-400" />
      <p class="text-sm font-medium text-zinc-900 dark:text-white">
        {{ selectedFile ? selectedFile.name : 'Drag and drop a theme ZIP file' }}
      </p>
      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">or click to browse</p>
      <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        BetterSEQTA: theme.json + optional images. DesQTA: theme-manifest.json + styles/.
      </p>
    </div>

    <label v-if="showNotes" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      Notes for reviewers (optional)
      <textarea
        v-model="notes"
        rows="3"
        class="mt-2 w-full resize-y rounded-lg border border-zinc-300 bg-white/50 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-white"
        placeholder="Anything reviewers should know about this submission"
      />
    </label>

    <ul v-if="errors.length" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
      <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
    </ul>
    <ul v-if="warnings.length" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <li v-for="(warn, i) in warnings" :key="i">{{ warn }}</li>
    </ul>

    <div class="flex justify-end">
      <button
        type="button"
        class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
        :disabled="uploading || !selectedFile"
        @click="submit"
      >
        <LoadingSpinner v-if="uploading" size="sm" />
        <span v-else>{{ submitLabel }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowUpTrayIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

withDefaults(
  defineProps<{
    uploading?: boolean
    showNotes?: boolean
    submitLabel?: string
    errors?: string[]
    warnings?: string[]
  }>(),
  { showNotes: true, submitLabel: 'Upload theme', errors: () => [], warnings: () => [] },
)

const emit = defineEmits<{ submit: [formData: FormData] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const notes = ref('')

function setFile(file: File | undefined) {
  if (file?.name.toLowerCase().endsWith('.zip')) selectedFile.value = file
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  setFile(e.dataTransfer?.files?.[0])
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  setFile(target.files?.[0])
  target.value = ''
}

function submit() {
  if (!selectedFile.value) return
  const formData = new FormData()
  formData.append('theme_zip', selectedFile.value)
  if (notes.value.trim()) formData.append('submission_notes', notes.value.trim())
  emit('submit', formData)
}
</script>
