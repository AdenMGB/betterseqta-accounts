<template>
  <div class="admin-scroll-tab space-y-6 max-w-2xl mx-auto">
    <div class="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
        :class="view === 'queue' ? 'bg-primary-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
        @click="view = 'queue'"
      >
        Review queue
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
        :class="view === 'history' ? 'bg-primary-500 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
        @click="openHistory"
      >
        Audit history
      </button>
    </div>

    <!-- Queue -->
    <div v-if="view === 'queue'" class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Profile picture audit</h3>
      <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Review uploaded profile pictures. Accept to approve, or remove with a reason. Change past choices under Audit history.
      </p>

      <div v-if="loading && !candidate" class="flex items-center justify-center gap-2 py-16 text-zinc-500">
        <LoadingSpinner size="sm" />
        Loading…
      </div>

      <div v-else-if="!candidate" class="text-center py-16 text-zinc-500 dark:text-zinc-400">
        <p class="font-medium text-zinc-700 dark:text-zinc-300">No more profile pictures to review</p>
        <p class="text-sm mt-2">Everyone pending review has been seen, or the queue is empty.</p>
        <button
          type="button"
          class="mt-4 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="resetAndLoad"
        >
          Start over
        </button>
      </div>

      <template v-else>
        <div class="flex flex-col items-center gap-4 mb-6">
          <button
            type="button"
            class="rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
            @click="$emit('view-pfp', bust(candidate.pfpUrl, candidate.pfpHash))"
          >
            <img
              :src="bust(candidate.pfpUrl, candidate.pfpHash)"
              :alt="`Profile picture for ${candidate.username}`"
              class="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover border-4 border-zinc-200 dark:border-zinc-600 shadow-lg"
            />
          </button>
          <div class="text-center">
            <p class="font-semibold text-zinc-900 dark:text-white">
              {{ candidate.displayName || candidate.username }}
            </p>
            <p class="text-sm text-zinc-500">@{{ candidate.username }}</p>
          </div>
        </div>

        <div v-if="removeMode" class="space-y-4 mb-4 p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <label class="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Reason for removal
            <select
              v-model="selectedReason"
              class="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white"
            >
              <option value="" disabled>Select a reason…</option>
              <option v-for="r in PFP_AUDIT_REASONS" :key="r" :value="r">{{ r }}</option>
            </select>
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm" :disabled="rejecting" @click="cancelRemove">
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
              :disabled="!selectedReason || rejecting"
              @click="confirmRemove"
            >
              {{ rejecting ? 'Removing…' : 'Confirm remove' }}
            </button>
          </div>
        </div>

        <div v-else class="flex items-center justify-between gap-3 w-full max-w-sm mx-auto">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            :disabled="loading"
            @click="removeMode = true"
          >
            Remove
          </button>
          <button
            type="button"
            class="px-6 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            :disabled="loading"
            @click="accept"
          >
            Accept
          </button>
        </div>
      </template>
    </div>

    <!-- History -->
    <div v-else class="space-y-4">
      <div class="bg-zinc-50 dark:bg-zinc-900/30 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Audit history</h3>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Final choices per picture (including edits). Newest first.
        </p>

        <div v-if="canViewOtherAdmins" class="mb-4">
          <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Admin user ID (senior only)</label>
          <div class="flex gap-2">
            <input
              v-model="historyAdminFilter"
              type="text"
              placeholder="Leave empty for your history"
              class="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 dark:text-white"
            />
            <button type="button" class="px-3 py-2 text-sm rounded-lg bg-primary-500 text-white shrink-0" @click="reloadHistory">
              Load
            </button>
          </div>
        </div>

        <div v-if="historyLoading && !historyItems.length" class="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
        <p v-else-if="!historyItems.length" class="text-sm text-zinc-500 text-center py-8">No audit decisions yet.</p>

        <ul v-else class="divide-y divide-zinc-200 dark:divide-zinc-700">
          <li v-for="item in historyItems" :key="item.id" class="py-4 flex gap-3 sm:gap-4">
            <button
              type="button"
              class="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
              @click="$emit('view-pfp', historyPfpSrc(item))"
            >
              <img
                :src="historyPfpSrc(item)"
                :alt="item.subjectUsername"
                class="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-600"
              />
            </button>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-zinc-900 dark:text-white truncate">
                {{ item.subjectDisplayName || item.subjectUsername }}
                <span class="text-zinc-500 font-normal text-sm">@{{ item.subjectUsername }}</span>
              </p>
              <p v-if="item.adminUsername && historyAdminFilter.trim()" class="text-xs text-zinc-500 mt-0.5">
                Admin: @{{ item.adminUsername }}
              </p>
              <div class="flex flex-wrap items-center gap-2 mt-1.5">
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="item.decision === 'accept'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'"
                >
                  {{ item.decision === 'accept' ? 'Accepted' : 'Removed' }}
                </span>
                <span v-if="item.removeReason" class="text-xs text-zinc-500">{{ item.removeReason }}</span>
              </div>
              <p class="text-xs text-zinc-400 mt-1">{{ formatWhen(item.updatedAt) }}</p>

              <div v-if="editingId === item.id" class="mt-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white/80 dark:bg-zinc-900/80 space-y-3">
                <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">Change decision</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm rounded-lg"
                    :class="editDecision === 'accept' ? 'bg-emerald-600 text-white' : 'border border-zinc-300 dark:border-zinc-600'"
                    @click="editDecision = 'accept'"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm rounded-lg"
                    :class="editDecision === 'remove' ? 'bg-red-600 text-white' : 'border border-zinc-300 dark:border-zinc-600'"
                    @click="editDecision = 'remove'"
                  >
                    Remove
                  </button>
                </div>
                <select
                  v-if="editDecision === 'remove'"
                  v-model="editReason"
                  class="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm dark:text-white"
                >
                  <option value="" disabled>Removal reason…</option>
                  <option v-for="r in PFP_AUDIT_REASONS" :key="r" :value="r">{{ r }}</option>
                </select>
                <div class="flex gap-2">
                  <button type="button" class="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600" @click="cancelEdit">
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="text-sm px-3 py-1.5 rounded-lg bg-primary-500 text-white disabled:opacity-50"
                    :disabled="savingEdit || (editDecision === 'remove' && !editReason)"
                    @click="saveEdit(item)"
                  >
                    {{ savingEdit ? 'Saving…' : 'Save' }}
                  </button>
                </div>
              </div>
              <button
                v-else
                type="button"
                class="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                @click="startEdit(item)"
              >
                Change decision
              </button>
            </div>
          </li>
        </ul>

        <button
          v-if="historyNextCursor"
          type="button"
          class="mt-4 w-full py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          :disabled="historyLoading"
          @click="loadMoreHistory"
        >
          {{ historyLoading ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import { useToast } from '~/composables/useToast'
import { useAuth } from '~/composables/useAuth'
import { withPfpCacheBust } from '~/utils/pfp'
import { PFP_AUDIT_REASONS, type PfpAuditReason } from '~/utils/pfpAuditReasons'

type AuditCandidate = {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string
  pfpHash: string
}

type AuditDecision = {
  id: string
  adminUserId: string
  adminUsername: string | null
  subjectUserId: string
  subjectUsername: string
  subjectDisplayName: string | null
  pfpHash: string
  pfpUrl: string
  pfpHistoryId: string | null
  decision: 'accept' | 'remove'
  removeReason: string | null
  updatedAt: number
}

defineEmits<{ 'view-pfp': [src: string] }>()

const auth = useAuth()
const { showToast } = useToast()

const view = ref<'queue' | 'history'>('queue')
const candidate = ref<AuditCandidate | null>(null)
const loading = ref(false)
const rejecting = ref(false)
const removeMode = ref(false)
const selectedReason = ref<PfpAuditReason | ''>('')
const excludeIds = ref<string[]>([])

const historyItems = ref<AuditDecision[]>([])
const historyLoading = ref(false)
const historyNextCursor = ref<number | null>(null)
const historyAdminFilter = ref('')
const editingId = ref<string | null>(null)
const editDecision = ref<'accept' | 'remove'>('accept')
const editReason = ref<PfpAuditReason | ''>('')
const savingEdit = ref(false)

const canViewOtherAdmins = computed(() => (auth.user.value?.admin_level ?? 0) >= 3)

const bust = (url: string, hash?: string) => withPfpCacheBust(url, hash)

const historyPfpSrc = (item: AuditDecision) => {
  if (item.decision === 'remove' && item.pfpHistoryId) {
    return bust(`/api/user/pfp/${item.subjectUserId}/hist/${item.pfpHistoryId}`, item.pfpHash)
  }
  return bust(item.pfpUrl, item.pfpHash)
}

const formatWhen = (unixSec: number) =>
  new Date(unixSec * 1000).toLocaleString()

const fetchNext = async () => {
  loading.value = true
  try {
    const exclude = excludeIds.value.join(',')
    const qs = exclude ? `?exclude=${encodeURIComponent(exclude)}` : ''
    const res = await $fetch<{ user: AuditCandidate | null }>(`/api/admin/pfp-audit/next${qs}`, {
      credentials: 'include',
    })
    candidate.value = res.user
    removeMode.value = false
    selectedReason.value = ''
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    showToast(err?.data?.error || 'Failed to load profile picture', 'error')
    candidate.value = null
  } finally {
    loading.value = false
  }
}

const fetchHistory = async (append: boolean) => {
  historyLoading.value = true
  try {
    const query: Record<string, string> = { limit: '30' }
    if (append && historyNextCursor.value) {
      query.cursor = String(historyNextCursor.value)
    }
    const adminId = historyAdminFilter.value.trim()
    if (adminId && canViewOtherAdmins.value) {
      query.admin_user_id = adminId
    }
    const res = await $fetch<{ decisions: AuditDecision[]; nextCursor: number | null }>(
      '/api/admin/pfp-audit/history',
      { credentials: 'include', query },
    )
    historyNextCursor.value = res.nextCursor
    historyItems.value = append ? [...historyItems.value, ...res.decisions] : res.decisions
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    showToast(err?.data?.error || 'Failed to load audit history', 'error')
  } finally {
    historyLoading.value = false
  }
}

const openHistory = () => {
  view.value = 'history'
  if (!historyItems.value.length) {
    void fetchHistory(false)
  }
}

const reloadHistory = () => {
  historyNextCursor.value = null
  void fetchHistory(false)
}

const loadMoreHistory = () => fetchHistory(true)

const accept = async () => {
  if (!candidate.value) return
  const userId = candidate.value.id
  loading.value = true
  try {
    await $fetch('/api/admin/pfp-audit/accept', {
      method: 'POST',
      credentials: 'include',
      body: { userId },
    })
    excludeIds.value.push(userId)
    await fetchNext()
    if (view.value === 'history') await fetchHistory(false)
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    showToast(err?.data?.error || 'Failed to accept profile picture', 'error')
  } finally {
    loading.value = false
  }
}

const cancelRemove = () => {
  removeMode.value = false
  selectedReason.value = ''
}

const confirmRemove = async () => {
  if (!candidate.value || !selectedReason.value) return
  rejecting.value = true
  const userId = candidate.value.id
  const reason = selectedReason.value
  try {
    await $fetch('/api/admin/pfp-audit/reject', {
      method: 'POST',
      credentials: 'include',
      body: { userId, reason },
    })
    showToast('Profile picture removed', 'success')
    excludeIds.value.push(userId)
    await fetchNext()
    if (view.value === 'history') await fetchHistory(false)
  } catch (e: unknown) {
    const err = e as { status?: number; statusCode?: number; data?: { error?: string } }
    const status = err?.status ?? err?.statusCode
    if (status === 409) {
      showToast('Already removed — loading next', 'info')
      excludeIds.value.push(userId)
      await fetchNext()
    } else {
      showToast(err?.data?.error || 'Failed to remove profile picture', 'error')
    }
  } finally {
    rejecting.value = false
  }
}

const startEdit = (item: AuditDecision) => {
  editingId.value = item.id
  editDecision.value = item.decision
  editReason.value = (item.removeReason as PfpAuditReason) || ''
}

const cancelEdit = () => {
  editingId.value = null
}

const saveEdit = async (item: AuditDecision) => {
  savingEdit.value = true
  try {
    await $fetch('/api/admin/pfp-audit/revise', {
      method: 'POST',
      credentials: 'include',
      body: {
        subjectUserId: item.subjectUserId,
        pfpHash: item.pfpHash,
        decision: editDecision.value,
        reason: editDecision.value === 'remove' ? editReason.value : undefined,
      },
    })
    showToast('Decision updated', 'success')
    editingId.value = null
    await fetchHistory(false)
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    showToast(err?.data?.error || 'Failed to update decision', 'error')
  } finally {
    savingEdit.value = false
  }
}

const resetAndLoad = () => {
  excludeIds.value = []
  fetchNext()
}

onMounted(() => {
  fetchNext()
})
</script>
