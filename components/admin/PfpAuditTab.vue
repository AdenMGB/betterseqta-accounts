<template>
  <div class="admin-scroll-tab space-y-6 max-w-xl mx-auto">
    <div class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Profile picture audit</h3>
      <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Review random uploaded profile pictures. Accept to skip, or remove with a reason to clear the user&apos;s current picture (saved in history for restore).
      </p>

      <div v-if="loading && !candidate" class="flex items-center justify-center gap-2 py-16 text-zinc-500">
        <LoadingSpinner size="sm" />
        Loading…
      </div>

      <div v-else-if="!candidate" class="text-center py-16 text-zinc-500 dark:text-zinc-400">
        <p class="font-medium text-zinc-700 dark:text-zinc-300">No more profile pictures to review</p>
        <p class="text-sm mt-2">Everyone with an uploaded picture has been seen this session, or none are left.</p>
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
            @click="$emit('view-pfp', bust(candidate.pfpUrl))"
          >
            <img
              :src="bust(candidate.pfpUrl)"
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
            <button
              type="button"
              class="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
              :disabled="rejecting"
              @click="cancelRemove"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import { useToast } from '~/composables/useToast'
import { withPfpCacheBust } from '~/utils/pfp'
import { PFP_AUDIT_REASONS, type PfpAuditReason } from '~/utils/pfpAuditReasons'

type AuditCandidate = {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string
  pfpHash: string
}

defineEmits<{ 'view-pfp': [src: string] }>()

const { showToast } = useToast()

const candidate = ref<AuditCandidate | null>(null)
const loading = ref(false)
const rejecting = ref(false)
const removeMode = ref(false)
const selectedReason = ref<PfpAuditReason | ''>('')
const excludeIds = ref<string[]>([])

const bust = (url: string) => {
  const v = candidate.value?.pfpHash
  return withPfpCacheBust(url, v)
}

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

const resetAndLoad = () => {
  excludeIds.value = []
  fetchNext()
}

onMounted(() => {
  fetchNext()
})
</script>
