<template>
  <div class="themes-detail-page w-full min-w-0 space-y-5 sm:space-y-6">
    <header>
      <NuxtLink
        to="/themes"
        class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-primary-500 dark:text-zinc-400"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        Back to My themes
      </NuxtLink>
    </header>

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
          @click="confirmDelete"
        >
          Delete theme
        </button>
      </div>

      <!-- Rejection banner -->
      <div
        v-if="theme.status === 'rejected' && theme.rejection_reason"
        class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900/50 dark:bg-red-950/30"
      >
        <p class="text-sm font-semibold text-red-800 dark:text-red-300">Rejected</p>
        <p class="mt-1 text-sm text-red-700 dark:text-red-400">{{ theme.rejection_reason }}</p>
        <p v-if="theme.reviewed_at" class="mt-2 text-xs text-red-600/80 dark:text-red-400/80">
          Reviewed {{ formatThemeDate(theme.reviewed_at) }}
        </p>
      </div>

      <!-- Pending info -->
      <div
        v-else-if="theme.status === 'pending'"
        class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/50 dark:bg-amber-950/30"
      >
        <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">Awaiting review</p>
        <p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
          Your theme is in the moderation queue. You can still edit metadata or replace files until it is approved.
        </p>
      </div>

      <!-- Approved info -->
      <div
        v-else-if="theme.status === 'approved'"
        class="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/30"
      >
        <p class="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Approved and public</p>
        <p class="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          This theme is visible in the community catalog. Approved themes cannot be edited — delete and re-submit to make changes.
        </p>
        <a
          v-if="publicUrl"
          :href="publicUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 underline dark:text-emerald-300"
        >
          View on betterseqta.org
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        </a>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <!-- Main details -->
        <section class="themes-card space-y-5 p-5 sm:p-6">
          <div v-if="previewUrl" class="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-700/60">
            <img :src="previewUrl" alt="" class="max-h-48 w-full object-cover" />
          </div>

          <dl class="grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Type</dt>
              <dd class="mt-1 capitalize text-zinc-900 dark:text-white">{{ theme.theme_type }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Version</dt>
              <dd class="mt-1 text-zinc-900 dark:text-white">{{ theme.version || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Submitted</dt>
              <dd class="mt-1 text-zinc-900 dark:text-white">{{ formatThemeDate(theme.created_at) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Last updated</dt>
              <dd class="mt-1 text-zinc-900 dark:text-white">{{ formatThemeDate(theme.updated_at) }}</dd>
            </div>
            <div v-if="theme.published_at">
              <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Published</dt>
              <dd class="mt-1 text-zinc-900 dark:text-white">{{ formatThemeDate(theme.published_at) }}</dd>
            </div>
            <div v-if="theme.download_count != null">
              <dt class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Downloads</dt>
              <dd class="mt-1 text-zinc-900 dark:text-white">{{ theme.download_count }}</dd>
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

          <!-- Metadata edit -->
          <div v-if="canEdit" class="border-t border-zinc-200/60 pt-5 dark:border-zinc-700/60">
            <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Edit metadata</h2>
            <form class="mt-4 space-y-4" @submit.prevent="saveMetadata">
              <div>
                <label for="meta-name" class="form-label">Name</label>
                <input id="meta-name" v-model="metaForm.name" type="text" class="mt-2 w-full form-input" />
              </div>
              <div>
                <label for="meta-desc" class="form-label">Description</label>
                <textarea id="meta-desc" v-model="metaForm.description" rows="3" class="mt-2 w-full form-input resize-y" />
              </div>
              <div>
                <label for="meta-notes" class="form-label">Submission notes</label>
                <textarea id="meta-notes" v-model="metaForm.submission_notes" rows="2" class="mt-2 w-full form-input resize-y" />
              </div>
              <div class="flex items-center justify-end gap-3">
                <p v-if="metaError" class="text-sm text-red-500">{{ metaError }}</p>
                <button type="submit" class="form-button-primary" :disabled="metaSaving">
                  <LoadingSpinner v-if="metaSaving" size="sm" />
                  <span v-else>Save changes</span>
                </button>
              </div>
            </form>
          </div>

          <!-- File replace -->
          <div v-if="canEdit" class="border-t border-zinc-200/60 pt-5 dark:border-zinc-700/60">
            <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Replace theme files</h2>
            <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Uploading new files will reset review to pending and clear any rejection reason.
            </p>
            <div class="mt-4">
              <ThemeUploadForm
                :uploading="replaceUploading"
                :show-notes="false"
                submit-label="Replace files"
                :validation-errors="replaceErrors"
                :validation-warnings="replaceWarnings"
                @submit="onReplaceFiles"
              />
            </div>
          </div>
        </section>

        <!-- File manifest -->
        <aside class="themes-card p-5 sm:p-6">
          <h2 class="text-sm font-semibold text-zinc-900 dark:text-white">Uploaded files</h2>
          <ul v-if="files.length" class="mt-4 space-y-2">
            <li
              v-for="file in files"
              :key="file.id"
              class="rounded-lg border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/60"
            >
              <p class="truncate text-sm font-medium text-zinc-900 dark:text-white">{{ file.file_path }}</p>
              <p class="mt-0.5 text-xs text-zinc-500">
                {{ file.file_type }} · {{ formatFileSize(file.file_size) }}
              </p>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-zinc-500">No files listed.</p>
        </aside>
      </div>
    </template>

    <ConfirmDialog
      :open="deleteOpen"
      title="Delete theme"
      :message="deleteMessage"
      confirm-label="Delete"
      destructive
      @cancel="deleteOpen = false"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import ThemeStatusBadge from '~/components/themes/ThemeStatusBadge.vue'
import ThemeUploadForm from '~/components/themes/ThemeUploadForm.vue'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import { useCustomThemes } from '~/composables/useCustomThemes'
import { useToast } from '~/composables/useToast'
import type { CustomThemeFile, CustomThemeOwner } from '~/types/customThemes'

const route = useRoute()
const router = useRouter()
const { getMine, updateMetadata, replaceFiles, remove, formatThemeDate, parseCustomThemesError } = useCustomThemes()
const { showToast } = useToast()

const themeId = computed(() => String(route.params.id))

const loading = ref(true)
const loadError = ref('')
const theme = ref<CustomThemeOwner | null>(null)
const files = ref<CustomThemeFile[]>([])

const metaForm = reactive({
  name: '',
  description: '',
  submission_notes: '',
})
const metaSaving = ref(false)
const metaError = ref('')

const replaceUploading = ref(false)
const replaceErrors = ref<string[]>([])
const replaceWarnings = ref<string[]>([])

const deleteOpen = ref(false)
const deleteMessage = computed(() =>
  theme.value ? `Delete "${theme.value.name}"? This cannot be undone.` : '',
)

const canEdit = computed(() => theme.value?.status === 'pending' || theme.value?.status === 'rejected')

const previewUrl = computed(() => {
  if (!theme.value) return null
  return (
    theme.value.coverImage ||
    theme.value.preview?.thumbnail ||
    theme.value.preview_thumbnail_url ||
    null
  )
})

const publicUrl = computed(() => {
  if (!theme.value?.slug || theme.value.status !== 'approved') return null
  return `https://betterseqta.org/api/custom-themes/by-slug/${encodeURIComponent(theme.value.slug)}`
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function syncMetaForm(t: CustomThemeOwner) {
  metaForm.name = t.name || ''
  metaForm.description = t.description || ''
  metaForm.submission_notes = t.submission_notes || ''
}

async function loadDetail() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await getMine(themeId.value)
    theme.value = data.theme
    files.value = data.files
    syncMetaForm(data.theme)
  } catch (e) {
    loadError.value = parseCustomThemesError(e)
    theme.value = null
    files.value = []
  } finally {
    loading.value = false
  }
}

async function saveMetadata() {
  if (!theme.value) return
  metaSaving.value = true
  metaError.value = ''
  try {
    const patch: Record<string, string> = {}
    if (metaForm.name.trim() && metaForm.name.trim() !== theme.value.name) {
      patch.name = metaForm.name.trim()
    }
    if (metaForm.description !== (theme.value.description || '')) {
      patch.description = metaForm.description
    }
    if (metaForm.submission_notes !== (theme.value.submission_notes || '')) {
      patch.submission_notes = metaForm.submission_notes
    }
    if (!Object.keys(patch).length) {
      showToast('No changes to save', 'success')
      return
    }
    const data = await updateMetadata(theme.value.id, patch)
    theme.value = data.theme
    syncMetaForm(data.theme)
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
    if (data.validation?.warnings?.length) {
      replaceWarnings.value = data.validation.warnings
    }
    await loadDetail()
    showToast('Files replaced — status reset to pending', 'success')
  } catch (e: unknown) {
    const err = e as { data?: { error?: { details?: { errors?: string[]; warnings?: string[] } } } }
    const details = err.data?.error?.details
    if (details?.errors?.length) replaceErrors.value = details.errors
    showToast(parseCustomThemesError(e), 'error')
  } finally {
    replaceUploading.value = false
  }
}

function confirmDelete() {
  deleteOpen.value = true
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

watch(themeId, () => {
  loadDetail()
})

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.themes-card {
  @apply rounded-2xl border border-zinc-200/50 bg-white/50 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-zinc-800/50;
}
</style>
