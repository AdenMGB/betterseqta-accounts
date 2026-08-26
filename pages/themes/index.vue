<template>
  <div class="themes-page w-full min-w-0 space-y-5 sm:space-y-6">
    <header class="animate-slide-down">
      <h1 class="font-display text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">My themes</h1>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Submit BetterSEQTA or DesQTA themes for community review. These are separate from the official theme store and require admin approval before they appear publicly.
      </p>
    </header>

    <!-- Status summary -->
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <div class="themes-card p-4 sm:p-5">
        <p class="text-sm text-zinc-500 dark:text-zinc-400">Pending review</p>
        <p class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ statusCounts.pending }}</p>
      </div>
      <div class="themes-card p-4 sm:p-5">
        <p class="text-sm text-zinc-500 dark:text-zinc-400">Approved</p>
        <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ statusCounts.approved }}</p>
      </div>
      <div class="themes-card p-4 sm:p-5">
        <p class="text-sm text-zinc-500 dark:text-zinc-400">Rejected</p>
        <p class="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{{ statusCounts.rejected }}</p>
      </div>
    </section>

    <!-- Submit -->
    <section class="themes-card overflow-hidden">
      <button
        type="button"
        class="flex w-full items-center justify-between px-5 py-4 text-left sm:px-6"
        @click="submitOpen = !submitOpen"
      >
        <div>
          <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">Submit a theme</h2>
          <p class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Upload a ZIP to start a new submission</p>
        </div>
        <ChevronDownIcon
          class="h-5 w-5 shrink-0 text-zinc-400 transition-transform"
          :class="{ 'rotate-180': submitOpen }"
        />
      </button>
      <div v-show="submitOpen" class="border-t border-zinc-200/60 px-5 py-5 dark:border-zinc-700/60 sm:px-6">
        <ThemeUploadForm
          :uploading="submitting"
          :validation-errors="submitErrors"
          :validation-warnings="submitWarnings"
          @submit="onSubmit"
        />
      </div>
    </section>

    <!-- Filters + list -->
    <section class="themes-card">
      <div class="relative z-30 flex flex-wrap items-center gap-3 border-b border-zinc-200/60 px-5 py-4 dark:border-zinc-700/60 sm:px-6">
        <UiSelect
          v-model="statusFilter"
          :options="statusOptions"
          @change="loadThemes(1)"
        />
        <UiSelect
          v-model="typeFilter"
          :options="typeOptions"
          @change="loadThemes(1)"
        />
        <button
          type="button"
          class="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          :disabled="loading"
          @click="refreshAll"
        >
          Refresh
        </button>
      </div>

      <div v-if="loading && !themes.length" class="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>

      <div v-else-if="loadError" class="px-5 py-8 text-center sm:px-6">
        <p class="text-sm text-red-500 dark:text-red-400">{{ loadError }}</p>
        <button type="button" class="mt-3 text-sm text-primary-500 underline" @click="refreshAll">Retry</button>
      </div>

      <div v-else-if="!themes.length" class="px-5 py-12 text-center sm:px-6">
        <p class="text-sm text-zinc-500 dark:text-zinc-400">No themes yet. Submit your first theme above.</p>
      </div>

      <div v-else class="admin-table-scroll overflow-x-auto overflow-y-visible">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="border-b border-zinc-200/60 bg-zinc-50/50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700/60 dark:bg-zinc-950/20 dark:text-zinc-400">
            <tr>
              <th class="px-5 py-3 font-semibold sm:px-6">Name</th>
              <th class="px-3 py-3 font-semibold">Type</th>
              <th class="px-3 py-3 font-semibold">Status</th>
              <th class="px-3 py-3 font-semibold">Submitted</th>
              <th class="px-5 py-3 font-semibold text-right sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-200/60 dark:divide-zinc-700/60">
            <tr v-for="theme in themes" :key="theme.id" class="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
              <td class="px-5 py-4 sm:px-6">
                <NuxtLink
                  :to="`/themes/${theme.id}`"
                  class="font-medium text-zinc-900 hover:text-primary-500 dark:text-white"
                >
                  {{ theme.name }}
                </NuxtLink>
                <p v-if="theme.slug" class="mt-0.5 text-xs text-zinc-500">{{ theme.slug }}</p>
              </td>
              <td class="px-3 py-4">
                <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {{ theme.theme_type }}
                </span>
              </td>
              <td class="px-3 py-4">
                <ThemeStatusBadge :status="theme.status" />
              </td>
              <td class="px-3 py-4 text-zinc-600 dark:text-zinc-400">
                {{ formatThemeDate(theme.created_at) }}
              </td>
              <td class="px-5 py-4 text-right sm:px-6">
                <div class="flex justify-end gap-2">
                  <NuxtLink
                    :to="`/themes/${theme.id}`"
                    class="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    View
                  </NuxtLink>
                  <button
                    type="button"
                    class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                    @click="confirmDelete(theme)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="pagination.total_pages > 1"
        class="flex items-center justify-between border-t border-zinc-200/60 px-5 py-4 dark:border-zinc-700/60 sm:px-6"
      >
        <p class="text-xs text-zinc-500">
          Page {{ pagination.page }} of {{ pagination.total_pages }} ({{ pagination.total }} total)
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-zinc-600"
            :disabled="pagination.page <= 1 || loading"
            @click="loadThemes(pagination.page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-zinc-600"
            :disabled="pagination.page >= pagination.total_pages || loading"
            @click="loadThemes(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <ConfirmDialog
      :open="deleteDialog.open"
      title="Delete theme"
      :message="deleteDialog.message"
      confirm-label="Delete"
      destructive
      @cancel="deleteDialog.open = false"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import ThemeStatusBadge from '~/components/themes/ThemeStatusBadge.vue'
import ThemeUploadForm from '~/components/themes/ThemeUploadForm.vue'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import UiSelect from '~/components/ui/Select.vue'
import { useCustomThemes } from '~/composables/useCustomThemes'
import { useToast } from '~/composables/useToast'
import type { CustomThemeOwner, CustomThemeStatus, CustomThemesPagination } from '~/types/customThemes'

const router = useRouter()
const { listMine, submit, remove, formatThemeDate, parseCustomThemesError } = useCustomThemes()
const { showToast } = useToast()

const submitOpen = ref(false)
const submitting = ref(false)
const submitErrors = ref<string[]>([])
const submitWarnings = ref<string[]>([])

const loading = ref(true)
const loadError = ref('')
const themes = ref<CustomThemeOwner[]>([])
const pagination = ref<CustomThemesPagination>({ page: 1, limit: 20, total: 0, total_pages: 1 })

const statusFilter = ref<CustomThemeStatus | ''>('')
const typeFilter = ref<'betterseqta' | 'desqta' | ''>('')

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'betterseqta', label: 'BetterSEQTA' },
  { value: 'desqta', label: 'DesQTA' },
]

const statusCounts = reactive({ pending: 0, approved: 0, rejected: 0 })

const deleteDialog = reactive({
  open: false,
  id: '',
  message: '',
})

async function loadStatusCounts() {
  try {
    const [pending, approved, rejected] = await Promise.all([
      listMine({ status: 'pending', limit: 1 }),
      listMine({ status: 'approved', limit: 1 }),
      listMine({ status: 'rejected', limit: 1 }),
    ])
    statusCounts.pending = pending.pagination.total
    statusCounts.approved = approved.pagination.total
    statusCounts.rejected = rejected.pagination.total
  } catch {
    // Non-blocking; summary cards may stay at 0
  }
}

async function loadThemes(page = 1) {
  loading.value = true
  loadError.value = ''
  try {
    const data = await listMine({
      page,
      limit: 20,
      status: statusFilter.value || undefined,
      type: typeFilter.value || undefined,
    })
    themes.value = data.themes
    pagination.value = data.pagination
  } catch (e) {
    loadError.value = parseCustomThemesError(e)
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadThemes(pagination.value.page), loadStatusCounts()])
}

async function onSubmit(formData: FormData) {
  submitting.value = true
  submitErrors.value = []
  submitWarnings.value = []
  try {
    const data = await submit(formData)
    if (data.validation?.warnings?.length) {
      submitWarnings.value = data.validation.warnings
    }
    showToast('Theme submitted for review', 'success')
    await refreshAll()
    await router.push(`/themes/${data.theme.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { error?: { details?: { errors?: string[]; warnings?: string[] } } } }
    const details = err.data?.error?.details
    if (details?.errors?.length) {
      submitErrors.value = details.errors
    } else if (details?.warnings?.length) {
      submitWarnings.value = details.warnings
    }
    showToast(parseCustomThemesError(e), 'error')
  } finally {
    submitting.value = false
  }
}

function confirmDelete(theme: CustomThemeOwner) {
  deleteDialog.id = theme.id
  deleteDialog.message = `Delete "${theme.name}"? This cannot be undone and removes all uploaded files.`
  deleteDialog.open = true
}

async function doDelete() {
  const id = deleteDialog.id
  deleteDialog.open = false
  try {
    await remove(id)
    showToast('Theme deleted', 'success')
    await refreshAll()
  } catch (e) {
    showToast(parseCustomThemesError(e), 'error')
  }
}

onMounted(async () => {
  await refreshAll()
})
</script>

<style scoped>
.themes-card {
  @apply rounded-2xl border border-zinc-200/50 bg-white/50 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-zinc-800/50;
}
</style>
