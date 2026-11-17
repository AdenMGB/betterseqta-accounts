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
        BetterSEQTA: theme.json + optional images. PNG/JPEG in the ZIP are converted to high-quality WebP automatically.
      </p>
    </div>

    <div class="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-700/80 dark:bg-zinc-950/20">
      <label class="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Cover image (optional, BetterSEQTA)
      </label>
      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Upload a PNG or JPEG — we convert it in your browser to <code class="text-[11px]">images/banner.webp</code> and
        <code class="text-[11px]">images/marquee.webp</code> (96% WebP quality, up to 4096px).
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref="coverInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          class="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-500/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-600 dark:text-zinc-300 dark:file:text-primary-300"
          @change="onCoverSelect"
        />
        <button
          v-if="coverImage"
          type="button"
          class="text-xs text-red-500 hover:text-red-400"
          @click="clearCover"
        >
          Remove cover
        </button>
      </div>
      <p v-if="coverImage" class="mt-2 text-xs text-zinc-500">Selected: {{ coverImage.name }}</p>
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

    <p v-if="prepStatus" class="text-xs text-zinc-500 dark:text-zinc-400">{{ prepStatus }}</p>

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
        :disabled="uploading || !canSubmit"
        @click="submit"
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
import { prepareBetterSeqtaThemeZipUpload, appendThemeCoverLooseFiles } from '~/utils/prepareBetterSeqtaThemeZipUpload'

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
const coverInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const coverImage = ref<File | null>(null)
const notes = ref('')
const prepStatus = ref('')

const canSubmit = computed(() => Boolean(selectedFile.value))

function setFile(file: File | undefined) {
  if (file?.name.toLowerCase().endsWith('.zip')) selectedFile.value = file
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file?.name.toLowerCase().endsWith('.zip')) {
    setFile(file)
    return
  }
  if (file && /^image\/(png|jpeg|webp)$/i.test(file.type)) {
    coverImage.value = file
  }
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  setFile(target.files?.[0])
  target.value = ''
}

function onCoverSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) coverImage.value = file
  target.value = ''
}

function clearCover() {
  coverImage.value = null
  if (coverInput.value) coverInput.value.value = ''
}

async function submit() {
  if (!canSubmit.value) return
  prepStatus.value = 'Preparing images…'
  try {
    const formData = new FormData()
    if (selectedFile.value) {
      prepStatus.value = 'Converting PNG/JPEG assets in ZIP to WebP…'
      const zip = await prepareBetterSeqtaThemeZipUpload(selectedFile.value, {
        coverImage: coverImage.value,
      })
      formData.append('theme_zip', zip)
    } else if (coverImage.value) {
      await appendThemeCoverLooseFiles(formData, coverImage.value)
    }
    if (notes.value.trim()) formData.append('submission_notes', notes.value.trim())
    prepStatus.value = ''
    emit('submit', formData)
  } catch (e) {
    prepStatus.value = ''
    console.error(e)
    alert(e instanceof Error ? e.message : 'Failed to prepare theme upload')
  }
}
</script>