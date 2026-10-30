<template>
  <Modal :is-open="isOpen" @close="emit('close')">
    <template #header>Manage badges</template>
    <template #body>
      <p v-if="user" class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        {{ user.displayName || user.username }}
        <span class="text-zinc-500 dark:text-zinc-500">({{ user.username }})</span>
      </p>

      <div v-if="loading" class="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>

      <div v-else-if="loadError" class="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
        {{ loadError }}
      </div>

      <template v-else>
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Preview</span>
          <ProfileBadgeStack
            :admin-level="user?.admin_level ?? 0"
            :signup-number="signupNumber"
            :badges="displayBadges"
          />
        </div>

        <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          Founder badges come from signup order (Admin → Signup Order). Only achievement badges can be assigned here.
        </p>

        <ul class="space-y-2">
          <li
            v-for="item in awardable"
            :key="item.key"
            class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-zinc-900 dark:text-white">{{ item.label }}</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{{ item.key }}</p>
            </div>
            <label class="inline-flex items-center gap-2 shrink-0 cursor-pointer">
              <span class="text-xs text-zinc-500 dark:text-zinc-400 sr-only">Granted</span>
              <input
                type="checkbox"
                class="rounded border-zinc-300 dark:border-zinc-600 text-primary-500 focus:ring-primary-500"
                :checked="grantedKeys.has(item.key)"
                :disabled="togglingKey === item.key"
                @change="onToggle(item.key, ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </li>
        </ul>

        <p v-if="awardable.length === 0" class="text-sm text-zinc-500 dark:text-zinc-400">
          No manually assignable badges are configured.
        </p>
      </template>
    </template>
    <template #footer>
      <button
        type="button"
        class="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200"
        @click="emit('close')"
      >
        Done
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '~/components/ui/Modal.vue'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import ProfileBadgeStack from '~/components/badges/ProfileBadgeStack.vue'
import type { BadgeItem } from '~/utils/badges'

type AdminUserRef = {
  id: string
  username: string
  displayName?: string | null
  admin_level?: number
  signup_number?: number | null
  badges?: BadgeItem[]
}

type AwardableRow = { key: string; label: string }

const props = defineProps<{
  isOpen: boolean
  user: AdminUserRef | null
}>()

const emit = defineEmits<{
  close: []
  updated: [payload: { userId: string; badges: BadgeItem[] }]
}>()

const loading = ref(false)
const loadError = ref('')
const awardable = ref<AwardableRow[]>([])
const grantedKeys = ref<Set<string>>(new Set())
const displayBadges = ref<BadgeItem[]>([])
const signupNumber = ref<number | null>(null)
const togglingKey = ref<string | null>(null)

async function loadBadges() {
  if (!props.user?.id) return
  loading.value = true
  loadError.value = ''
  try {
    const res = await $fetch<{
      signup_number: number | null
      badges: BadgeItem[]
      achievement_keys: string[]
      awardable: AwardableRow[]
    }>('/api/admin/user/badges', {
      query: { userId: props.user.id },
      credentials: 'include',
    })
    signupNumber.value = res.signup_number ?? props.user.signup_number ?? null
    displayBadges.value = res.badges ?? []
    awardable.value = res.awardable ?? []
    grantedKeys.value = new Set(res.achievement_keys ?? [])
  } catch (e: any) {
    loadError.value = e?.data?.error || 'Failed to load badges'
  } finally {
    loading.value = false
  }
}

async function onToggle(badgeKey: string, shouldGrant: boolean) {
  if (!props.user?.id || togglingKey.value) return

  const previous = new Set(grantedKeys.value)
  if (shouldGrant) {
    grantedKeys.value.add(badgeKey)
  } else {
    grantedKeys.value.delete(badgeKey)
  }
  grantedKeys.value = new Set(grantedKeys.value)

  togglingKey.value = badgeKey
  try {
    const res = await $fetch<{
      success: boolean
      userId: string
      badges: BadgeItem[]
    }>('/api/admin/user/badges', {
      method: 'POST',
      credentials: 'include',
      body: {
        userId: props.user.id,
        badge_key: badgeKey,
        action: shouldGrant ? 'award' : 'revoke',
      },
    })
    displayBadges.value = res.badges ?? []
    emit('updated', { userId: res.userId, badges: res.badges ?? [] })
    loadError.value = ''
  } catch (e: any) {
    grantedKeys.value = previous
    loadError.value = e?.data?.error || 'Failed to update badge'
  } finally {
    togglingKey.value = null
  }
}

watch(
  () => [props.isOpen, props.user?.id] as const,
  ([open, id]) => {
    if (open && id) {
      loadBadges()
    } else if (!open) {
      loadError.value = ''
      togglingKey.value = null
    }
  },
)
</script>
