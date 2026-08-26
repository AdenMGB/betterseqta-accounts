<template>
  <div class="space-y-4">
    <div
      @drop.prevent="onDrop"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      :class="[
        'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        isDragging
          ? 'border-primary-500 bg-primary-500/10'
          : 'border-zinc-300 bg-zinc-50/50 dark:border-zinc-600 dark:bg-zinc-950/20',
        disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
      ]"
      @click="!disabled && fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".zip,application/zip"
        class="hidden"
        :disabled="disabled"
        @change="onFileSelect"
      />
      <ArrowUpTrayIcon class="mx-auto mb-3 h-10 w-10 text-zinc-400" />
      <p class="text-sm font-medium text-zinc-900 dark:text-white">
        {{ selectedFile ? selectedFile.name : 'Drag and drop a theme ZIP file' }}
      </p>
      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">or click to browse</p>
      <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        BetterSEQTA: theme.json + optional images. DesQTA: theme-manifest.json + styles/.
      </p>
    </div>

    <div v-if="showNotes">
      <label :for="notesId" class="form-label">Notes for reviewers (optional)</label>
      <textarea
        :id="notesId"
        v-model="submissionNotes"
        rows="3"
        class="mt-2 w-full form-input resize-y"
        placeholder="Anything reviewers should know about this submission"
        :disabled="disabled"
      />
    </div>

    <ul v-if="validationErrors.length" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
      <li v-for="(err, i) in validationErrors" :key="i">{{ err }}</li>
    </ul>

    <ul v-if="validationWarnings.length" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <li v-for="(warn, i) in validationWarnings" :key="i">{{ warn }}</li>
    </ul>

    <div v-if="showSubmitButton" class="flex justify-end">
      <button
        type="button"
        class="form-button-primary"
        :disabled="disabled || uploading || !selectedFile"
        @click.stop="submit"
      >
        <LoadingSpinner v-if="uploading" size="sm" />
        <span v-else>{{ submitLabel }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowUpTrayIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    uploading?: boolean
    showNotes?: boolean
    showSubmitButton?: boolean
    submitLabel?: string
    validationErrors?: string[]
    validationWarnings?: string[]
  }>(),
  {
    disabled: false,
    uploading: false,
    showNotes: true,
    showSubmitButton: true,
    submitLabel: 'Upload theme',
    validationErrors: () => [],
    validationWarnings: () => [],
  },
)

const emit = defineEmits<{
  submit: [formData: FormData]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const submissionNotes = ref('')

const notesId = computed(() => `theme-notes-${Math.random().toString(36).slice(2, 9)}`)

function setFile(file: File | null) {
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.zip')) return
  selectedFile.value = file
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (props.disabled) return
  const file = e.dataTransfer?.files?.[0]
  setFile(file ?? null)
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  setFile(target.files?.[0] ?? null)
  target.value = ''
}

function buildFormData(): FormData | null {
  if (!selectedFile.value) return null
  const formData = new FormData()
  formData.append('theme_zip', selectedFile.value)
  if (submissionNotes.value.trim()) {
    formData.append('submission_notes', submissionNotes.value.trim())
  }
  return formData
}

function submit() {
  const formData = buildFormData()
  if (!formData) return
  emit('submit', formData)
}

function reset() {
  selectedFile.value = null
  submissionNotes.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

defineExpose({ buildFormData, reset, selectedFile, submissionNotes })
</script>
