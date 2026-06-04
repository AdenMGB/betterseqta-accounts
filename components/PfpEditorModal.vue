<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen && user"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="$emit('close')"
    >
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          class="w-full max-w-lg bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-6"
        >
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-semibold text-zinc-900 dark:text-white">Profile Pictures</h3>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {{ user.displayName || user.username }}
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              @click="$emit('close')"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
            <div class="flex flex-col items-center gap-2">
              <button
                type="button"
                class="rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
                @click="$emit('view', bust(currentSrc))"
              >
                <img
                  :src="bust(currentSrc)"
                  alt="Current profile picture"
                  class="w-20 h-20 rounded-full object-cover border-2 border-primary-500 shadow"
                />
              </button>
              <span class="text-xs font-medium text-primary-500">Current</span>
              <button
                type="button"
                class="text-xs px-3 py-1 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                :disabled="uploading"
                @click="fileInput?.click()"
              >
                {{ uploading ? 'Uploading...' : 'Change' }}
              </button>
            </div>

            <div
              v-for="(h, idx) in localHistory"
              :key="h.id"
              class="flex flex-col items-center gap-2"
            >
              <button
                type="button"
                class="rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
                @click="$emit('view', bust(h.r2Key))"
              >
                <img
                  :src="bust(h.r2Key)"
                  :alt="`Past profile picture ${idx + 1}`"
                  class="w-20 h-20 rounded-full object-cover border-2 border-zinc-300 dark:border-zinc-600 shadow"
                />
              </button>
              <span class="text-xs text-zinc-500 dark:text-zinc-400">Past</span>
              <span v-if="h.createdAt" class="text-[10px] text-zinc-400">{{ formatRelativeTime(h.createdAt) }}</span>
              <button
                type="button"
                class="text-xs px-3 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                :disabled="restoringId === h.id"
                @click="restore(h)"
              >
                {{ restoringId === h.id ? 'Restoring...' : 'Restore' }}
              </button>
            </div>

            <div
              v-for="n in emptySlots"
              :key="`empty-${n}`"
              class="flex flex-col items-center gap-2"
            >
              <div class="w-20 h-20 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
                <span class="text-xs text-zinc-400">Empty</span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mb-4">
            <button
              v-if="canClear"
              type="button"
              class="text-xs px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              :disabled="clearing"
              @click="clearPfp"
            >
              {{ clearing ? 'Clearing...' : 'Clear profile picture' }}
            </button>
          </div>

          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            Up to 4 profile pictures are kept (current + 3 past). Changing or restoring shifts the stack — the oldest past picture is removed when full.
          </p>

          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileSelected"
          />
        </div>
      </Transition>
    </div>
  </Transition>

  <ImageCropper
    :is-open="cropperOpen"
    :image-src="cropperSrc"
    @confirm="onCropConfirm"
    @cancel="closeCropper"
  />

  <ConfirmDialog
    :open="confirmOpen"
    :title="confirmTitle"
    :message="confirmMessage"
    :confirm-label="confirmLabel"
    :destructive="confirmDestructive"
    @cancel="closeConfirm"
    @confirm="runConfirm"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import ImageCropper from '~/components/ui/ImageCropper.vue'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import { useToast } from '~/composables/useToast'
import { withPfpCacheBust, formatRelativeTime, dicebearUrl } from '~/utils/pfp'

type PfpHistoryItem = {
  id: string
  r2Key: string
  createdAt?: number
}

type UserLike = {
  id: string
  username: string
  displayName?: string | null
  pfpUrl?: string | null
  pfpHash?: string | null
  pfpHistory?: PfpHistoryItem[]
}

const props = defineProps<{
  isOpen: boolean
  user: UserLike | null
  mode?: 'admin' | 'self'
  cacheVersion?: number | string
}>()

const emit = defineEmits<{
  close: []
  view: [src: string]
  updated: [payload: { pfpUrl: string | null; pfpHash: string | null; pfpHistory: PfpHistoryItem[] }]
}>()

const { showToast } = useToast()
const mode = computed(() => props.mode ?? 'admin')

const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmLabel = ref('Confirm')
const confirmDestructive = ref(false)
let confirmHandler: (() => void) | null = null

const openConfirm = (opts: {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) => {
  confirmTitle.value = opts.title
  confirmMessage.value = opts.message
  confirmLabel.value = opts.confirmLabel ?? 'Confirm'
  confirmDestructive.value = !!opts.destructive
  confirmHandler = opts.onConfirm
  confirmOpen.value = true
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmHandler = null
}

const runConfirm = () => {
  confirmHandler?.()
  closeConfirm()
}

const fileInput = ref<HTMLInputElement | null>(null)
const cropperOpen = ref(false)
const cropperSrc = ref<string | null>(null)
const uploading = ref(false)
const restoringId = ref<string | null>(null)
const clearing = ref(false)
const localHistory = ref<PfpHistoryItem[]>([])
const localPfpUrl = ref<string | null>(null)
const localPfpHash = ref<string | null>(null)
const localViewVersion = ref(0)

const currentSrc = computed(() => {
  if (!props.user) return ''
  return localPfpUrl.value || props.user.pfpUrl || dicebearUrl(props.user.id)
})

const canClear = computed(() => !!(localPfpUrl.value || props.user?.pfpUrl))
const emptySlots = computed(() => Math.max(0, 3 - localHistory.value.length))
const bustVersion = computed(() => localPfpHash.value || props.cacheVersion)
const bust = (url: string) => withPfpCacheBust(url, bustVersion.value)
const bumpView = () => { localViewVersion.value = Date.now() }

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

watch(
  () => [props.isOpen, props.user?.id, props.user?.pfpUrl, props.user?.pfpHistory] as const,
  ([open]) => {
    if (open && props.user) {
      localHistory.value = [...(props.user.pfpHistory ?? [])]
      localPfpUrl.value = props.user.pfpUrl ?? null
      localPfpHash.value = props.user.pfpHash ?? null
    }
    if (!open) {
      cropperOpen.value = false
      cropperSrc.value = null
    }
  },
  { immediate: true },
)

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error')
    target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large (max 5MB)', 'error')
    target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    cropperSrc.value = reader.result as string
    cropperOpen.value = true
  }
  reader.readAsDataURL(file)
  target.value = ''
}

const closeCropper = () => {
  cropperOpen.value = false
  cropperSrc.value = null
}

const onCropConfirm = async (file: File) => {
  if (!props.user) return
  closeCropper()
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('preCropped', 'true')
    if (mode.value === 'admin') {
      formData.append('userId', props.user.id)
    }
    const url = mode.value === 'admin' ? '/api/admin/user/pfp' : '/api/user/pfp'
    const res = await $fetch<{ pfpUrl: string; pfpHash: string; pfpHistory: PfpHistoryItem[] }>(url, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    })
    localHistory.value = res.pfpHistory
    localPfpUrl.value = res.pfpUrl
    localPfpHash.value = res.pfpHash
    bumpView()
    emit('updated', { pfpUrl: res.pfpUrl, pfpHash: res.pfpHash, pfpHistory: res.pfpHistory })
    showToast('Profile picture updated', 'success')
  } catch (e: any) {
    showToast(e?.data?.error || 'Failed to upload profile picture', 'error')
  } finally {
    uploading.value = false
  }
}

const restore = (history: PfpHistoryItem) => {
  if (!props.user) return
  openConfirm({
    title: 'Restore profile picture',
    message: `Restore this past profile picture for ${props.user.displayName || props.user.username}?`,
    confirmLabel: 'Restore',
    onConfirm: () => doRestore(history),
  })
}

const doRestore = async (history: PfpHistoryItem) => {
  if (!props.user) return
  restoringId.value = history.id
  try {
    const url = mode.value === 'admin' ? '/api/admin/user/pfp/revert' : '/api/user/pfp/revert'
    const body = mode.value === 'admin'
      ? { userId: props.user.id, historyId: history.id }
      : { historyId: history.id }
    const res = await $fetch<{ pfpUrl: string; pfpHash: string; pfpHistory: PfpHistoryItem[] }>(url, {
      method: 'POST',
      headers: authHeaders(),
      body,
    })
    localHistory.value = res.pfpHistory
    localPfpUrl.value = res.pfpUrl
    localPfpHash.value = res.pfpHash
    bumpView()
    emit('updated', { pfpUrl: res.pfpUrl, pfpHash: res.pfpHash, pfpHistory: res.pfpHistory })
    showToast('Profile picture restored', 'success')
  } catch (e: any) {
    showToast(e?.data?.error || 'Failed to restore profile picture', 'error')
  } finally {
    restoringId.value = null
  }
}

const clearPfp = () => {
  if (!props.user) return
  openConfirm({
    title: 'Clear profile picture',
    message: `Remove the current profile picture for ${props.user.displayName || props.user.username}?`,
    confirmLabel: 'Clear',
    destructive: true,
    onConfirm: () => doClearPfp(),
  })
}

const doClearPfp = async () => {
  if (!props.user) return
  clearing.value = true
  try {
    const url = mode.value === 'admin' ? '/api/admin/user/pfp/clear' : '/api/user/pfp/clear'
    const body = mode.value === 'admin' ? { userId: props.user.id } : undefined
    const res = await $fetch<{ pfpUrl: null; pfpHash: null; pfpHistory: PfpHistoryItem[] }>(url, {
      method: 'POST',
      headers: authHeaders(),
      body,
    })
    localHistory.value = res.pfpHistory
    localPfpUrl.value = null
    localPfpHash.value = null
    bumpView()
    emit('updated', { pfpUrl: null, pfpHash: null, pfpHistory: res.pfpHistory })
    showToast('Profile picture cleared', 'success')
  } catch (e: any) {
    showToast(e?.data?.error || 'Failed to clear profile picture', 'error')
  } finally {
    clearing.value = false
  }
}
</script>
