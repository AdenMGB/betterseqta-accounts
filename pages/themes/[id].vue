<template>
  <div class="w-full min-w-0 space-y-5 sm:space-y-6">
    <NuxtLink
      to="/themes"
      class="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-primary-500 dark:text-zinc-400"
    >
      <ArrowLeftIcon class="h-4 w-4" />
      Back to My themes
    </NuxtLink>

    <div v-if="loading" class="flex justify-center py-20">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="loadError" class="themes-card px-5 py-12 text-center sm:px-6">
      <p class="text-sm text-red-500 dark:text-red-400">{{ loadError }}</p>
      <NuxtLink to="/themes" class="mt-4 inline-block text-sm text-primary-500 underline">Return to list</NuxtLink>
    </div>

    <template v-else-if="theme">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="font-display text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">{{ theme.name }}</h1>
            <ThemeStatusBadge :status="theme.status" />
          </div>
          <p v-if="theme.slug" class="mt-1 text-sm text-zinc-500">{{ theme.slug }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
          @click="deleteOpen = true"
        >
          Delete theme
        </button>
      </div>

      <div v-if="banner" class="rounded-xl border px-5 py-4" :class="banner.class">
        <p class="text-sm font-semibold">{{ banner.title }}</p>
        <p class="mt-1 text-sm">{{ banner.body }}</p>
        <p v-if="theme.status === 'rejected' && theme.reviewed_at" class="mt-2 text-xs opacity-80">
          Reviewed {{ formatThemeDate(theme.reviewed_at) }}
        </p>
        <a
          v-if="publicUrl"
          :href="publicUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-flex items-center gap-1 text-sm font-medium underline"
        >
          View on betterseqta.org
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        </a>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <section class="themes-card space-y-5 p-5 sm:p-6">
          <img v-if="previewUrl" :src="previewUrl" alt="" class="max-h-48 w-full rounded-xl border border-zinc-200/80 object-cover dark:border-zinc-700/60" />

          <dl class="grid gap-4 sm:grid-cols-2">
            <div v-for="[label, value] in details" :key="label">
              <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">{{ label }}</dt>
              <dd class="mt-1 text-zinc-900 dark:text-white">{{ value }}</dd>
            </div>
          </dl>

          <div v-if="theme.description">
            <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Description</h2>
            <p class="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{{ theme.description }}</p>
          </div>
          <div v-if="theme.submission_notes">
            <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Submission notes</h2>
            <p class="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{{ theme.submission_notes }}</p>
          </div>

          <template v-if="canEdit">
            <form class="space-y-4 border-t border-zinc-200/60 pt-5 dark:border-zinc-700/60" @submit.prevent="saveMetadata">
              <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Edit metadata</h2>
              <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Name
                <input v-model="metaForm.name" type="text" required :class="INPUT_CLASS" />
              </label>
              <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description
                <textarea v-model="metaForm.description" rows="3" :class="INPUT_CLASS" />
              </label>
              <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Submission notes
                <textarea v-model="metaForm.submission_notes" rows="2" :class="INPUT_CLASS" />
              </label>
              <div class="flex items-center justify-end gap-3">
                <p v-if="metaError" class="text-sm text-red-500">{{ metaError }}</p>
                <button
                  type="submit"
                  class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                  :disabled="metaSaving"
                >
                  <LoadingSpinner v-if="metaSaving" size="sm" />
                  <span v-else>Save changes</span>
                </button>
              </div>
            </form>

            <div class="border-t border-zinc-200/60 pt-5 dark:border-zinc-700/60">
              <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Replace theme files</h2>
              <p class="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Uploading new files will reset review to pending and clear any rejection reason.
              </p>
              <ThemeUploadForm
                :uploading="replaceUploading"
                :show-notes="false"
                submit-label="Replace files"
                :errors="replaceErrors"
                :warnings="replaceWarnings"
                @submit="onReplaceFiles"
              />
            </div>
          </template>
        </section>

        <aside class="themes-card p-5 sm:p-6">
          <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Uploaded files</h2>
          <ul v-if="files.length" class="mt-4 space-y-2">
            <li v-for="file in files" :key="file.id" class="rounded-lg border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/60">
              <p class="truncate text-sm font-medium text-zinc-900 dark:text-white">{{ file.file_path }}</p>
              <p class="mt-0.5 text-xs text-zinc-500">{{ file.file_type }} · {{ formatFileSize(file.file_size) }}</p>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-zinc-500">No files listed.</p>
        </aside>
      </div>
    </template>

    <ConfirmDialog
      :open="deleteOpen"
      title="Delete theme"
      :message="`Delete “${theme?.name}”? This cannot be undone.`"
      confirm-label="Delete"
      destructive
      @cancel="deleteOpen = false"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import ThemeStatusBadge from '~/components/themes/ThemeStatusBadge.vue'
import ThemeUploadForm from '~/components/themes/ThemeUploadForm.vue'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import {
  useCustomThemes,
  formatThemeDate,
  parseCustomThemesError,
  themeErrorDetails,
  type CustomTheme,
  type CustomThemeFile,
} from '~/composables/useCustomThemes'
import { useToast } from '~/composables/useToast'

const INPUT_CLASS =
  'mt-2 w-full resize-y rounded-lg border border-zinc-300 bg-white/50 px-3 py-2 font-normal text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-white'

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const { getMine, updateMetadata, replaceFiles, remove } = useCustomThemes()
const { showToast } = useToast()

const loading = ref(true)
const loadError = ref('')
const theme = ref<CustomTheme | null>(null)
const files = ref<CustomThemeFile[]>([])
const metaForm = reactive({ name: '', description: '', submission_notes: '' })
const metaSaving = ref(false)
const metaError = ref('')
const replaceUploading = ref(false)
const replaceErrors = ref<string[]>([])
const replaceWarnings = ref<string[]>([])
const deleteOpen = ref(false)

const canEdit = computed(() => theme.value?.status === 'pending' || theme.value?.status === 'rejected')
const previewUrl = computed(() => theme.value?.coverImage || theme.value?.preview?.thumbnail || theme.value?.preview_thumbnail_url)

const publicUrl = computed(() => {
  if (theme.value?.status !== 'approved' || !theme.value.slug) return null
  const base = String(config.public.bsplusUrl || 'https://betterseqta.org').replace(/\/$/, '')
  return `${base}/api/custom-themes/by-slug/${encodeURIComponent(theme.value.slug)}`
})

const banner = computed(() => {
  switch (theme.value?.status) {
    case 'rejected':
      return theme.value.rejection_reason
        ? {
            class: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
            title: 'Rejected',
            body: theme.value.rejection_reason,
          }
        : null
    case 'pending':
      return {
        class: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
        title: 'Awaiting review',
        body: 'Your theme is in the moderation queue. You can still edit metadata or replace files until it is approved.',
      }
    case 'approved':
      return {
        class: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
        title: 'Approved and public',
        body: 'This theme is visible in the community catalog. Approved themes cannot be edited — delete and re-submit to make changes.',
      }
    default:
      return null
  }
})

const details = computed((): [string, string | number][] => {
  const t = theme.value
  if (!t) return []
  const rows: [string, string | number | null | undefined][] = [
    ['Type', t.theme_type === 'desqta' ? 'DesQTA' : 'BetterSEQTA'],
    ['Version', t.version || '—'],
    ['Submitted', formatThemeDate(t.created_at)],
    ['Last updated', formatThemeDate(t.updated_at)],
    ['Published', t.published_at ? formatThemeDate(t.published_at) : null],
    ['Downloads', t.download_count],
  ]
  return rows.filter((row): row is [string, string | number] => row[1] != null)
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function setTheme(t: CustomTheme) {
  theme.value = t
  Object.assign(metaForm, { name: t.name, description: t.description || '', submission_notes: t.submission_notes || '' })
}

async function loadDetail() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await getMine(String(route.params.id))
    setTheme(data.theme)
    files.value = data.files
  } catch (e) {
    loadError.value = parseCustomThemesError(e)
    theme.value = null
  } finally {
    loading.value = false
  }
}

async function saveMetadata() {
  if (!theme.value) return
  metaSaving.value = true
  metaError.value = ''
  try {
    const data = await updateMetadata(theme.value.id, { ...metaForm, name: metaForm.name.trim() })
    setTheme(data.theme)
    showToast('Metadata saved', 'success')
  } catch (e) {
    metaError.value = parseCustomThemesError(e)
  } finally {
    metaSaving.value = false
  }
}

async function onReplaceFiles(formData: FormData) {
  if (!theme.value) return
  replaceUploading.value = true
  replaceErrors.value = []
  replaceWarnings.value = []
  try {
    const data = await replaceFiles(theme.value.id, formData)
    replaceWarnings.value = data.validation?.warnings ?? []
    await loadDetail()
    showToast('Files replaced — status reset to pending', 'success')
  } catch (e) {
    replaceErrors.value = themeErrorDetails(e).errors ?? []
    showToast(parseCustomThemesError(e), 'error')
  } finally {
    replaceUploading.value = false
  }
}

async function doDelete() {
  if (!theme.value) return
  deleteOpen.value = false
  try {
    await remove(theme.value.id)
    showToast('Theme deleted', 'success')
    await router.push('/themes')
  } catch (e) {
    showToast(parseCustomThemesError(e), 'error')
  }
}

watch(() => route.params.id, loadDetail, { immediate: true })
</script>

<style scoped>
.themes-card {
  @apply rounded-2xl border border-zinc-200/50 bg-white/50 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-zinc-800/50;
}
</style>
