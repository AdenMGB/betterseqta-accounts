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

          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            <div class="flex flex-col items-center gap-2">
              <button
                type="button"
                class="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
                @click="$emit('view', currentSrc)"
              >
                <img
                  :src="currentSrc"
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
                @click="$emit('view', h.r2Key)"
              >
                <img
                  :src="h.r2Key"
                  :alt="`Past profile picture ${idx + 1}`"
                  class="w-20 h-20 rounded-full object-cover border-2 border-zinc-300 dark:border-zinc-600 shadow"
                />
              </button>
              <span class="text-xs text-zinc-500 dark:text-zinc-400">Past</span>
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
              <span class="text-xs text-zinc-400 invisible">Past</span>
              <span class="text-xs invisible px-3 py-1">Restore</span>
            </div>
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
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import ImageCropper from '~/components/ui/ImageCropper.vue'
import { useToast } from '~/composables/useToast'

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
  pfpHistory?: PfpHistoryItem[]
}

const props = defineProps<{
  isOpen: boolean
  user: UserLike | null
}>()

const emit = defineEmits<{
  close: []
  view: [src: string]
  updated: [payload: { pfpUrl: string; pfpHistory: PfpHistoryItem[] }]
}>()

const { showToast } = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const cropperOpen = ref(false)
const cropperSrc = ref<string | null>(null)
const uploading = ref(false)
const restoringId = ref<string | null>(null)
const localHistory = ref<PfpHistoryItem[]>([])

const currentSrc = computed(() => {
  if (!props.user) return ''
  return props.user.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${props.user.id}`
})

const emptySlots = computed(() => Math.max(0, 3 - localHistory.value.length))

watch(
  () => [props.isOpen, props.user?.pfpHistory] as const,
  ([open]) => {
    if (open && props.user) {
      localHistory.value = [...(props.user.pfpHistory ?? [])]
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
    formData.append('userId', props.user.id)
    formData.append('file', file)
    const res = await $fetch<{ pfpUrl: string; pfpHistory: PfpHistoryItem[] }>('/api/admin/user/pfp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    })
    localHistory.value = res.pfpHistory
    emit('updated', { pfpUrl: res.pfpUrl, pfpHistory: res.pfpHistory })
    showToast('Profile picture updated', 'success')
  } catch (e: any) {
    showToast(e?.data?.error || 'Failed to upload profile picture', 'error')
  } finally {
    uploading.value = false
  }
}

const restore = async (history: PfpHistoryItem) => {
  if (!props.user) return
  if (!confirm(`Restore this profile picture for ${props.user.displayName || props.user.username}?`)) return
  restoringId.value = history.id
  try {
    const res = await $fetch<{ pfpUrl: string; pfpHistory: PfpHistoryItem[] }>('/api/admin/user/pfp/revert', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: { userId: props.user.id, historyId: history.id },
    })
    localHistory.value = res.pfpHistory
    emit('updated', { pfpUrl: res.pfpUrl, pfpHistory: res.pfpHistory })
    showToast('Profile picture restored', 'success')
  } catch (e: any) {
    showToast(e?.data?.error || 'Failed to restore profile picture', 'error')
  } finally {
    restoringId.value = null
  }
}
</script>
