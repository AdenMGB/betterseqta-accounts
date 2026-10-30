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
      role="presentation"
      @click.self="emit('close')"
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
          class="w-full max-w-lg max-h-[min(90vh,640px)] flex flex-col bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-badges-modal-title"
        >
          <div class="flex items-start justify-between gap-4 p-6 pb-4 shrink-0">
            <div class="min-w-0">
              <h3
                id="admin-badges-modal-title"
                class="text-xl font-semibold text-zinc-900 dark:text-white"
              >
                Manage badges
              </h3>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {{ user.displayName || user.username }}
                <span v-if="user.displayName && user.displayName !== user.username" class="text-zinc-400 dark:text-zinc-500">
                  · @{{ user.username }}
                </span>
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
              aria-label="Close"
              @click="emit('close')"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="px-6 pb-6 overflow-y-auto overscroll-contain admin-table-scroll space-y-4">
            <div v-if="loading" class="flex justify-center py-12">
              <LoadingSpinner size="md" />
            </div>

            <div
              v-else-if="loadError"
              class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
            >
              {{ loadError }}
            </div>

            <template v-else>
              <div class="bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Preview
                </p>
                <ProfileBadgeStack
                  :admin-level="user.admin_level ?? 0"
                  :signup-number="signupNumber"
                  :badges="displayBadges"
                />
              </div>

              <p class="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Founder badges come from signup order (Admin → Signup Order). Only achievement badges can be assigned here.
              </p>
              <p
                v-if="!canRevokeAchievements"
                class="text-xs leading-relaxed text-amber-700 dark:text-amber-400/90 rounded-lg border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2"
              >
                This user is an admin. You can grant achievement badges, but only they can remove their own.
              </p>

              <div class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20">
                <ul class="divide-y divide-zinc-200/70 dark:divide-zinc-700/70">
                  <li
                    v-for="item in awardable"
                    :key="item.key"
                    class="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-zinc-900 dark:text-white">
                        {{ item.label }}
                      </p>
                      <p class="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate mt-0.5">
                        {{ item.key }}
                      </p>
                    </div>
                    <label
                      class="inline-flex items-center gap-2 shrink-0"
                      :class="checkboxDisabled(item.key) ? 'cursor-not-allowed opacity-70' : 'cursor-pointer group'"
                    >
                      <span
                        class="text-xs font-medium text-zinc-500 dark:text-zinc-400 transition-colors duration-200"
                        :class="grantedKeys.has(item.key) ? 'text-primary-600 dark:text-primary-400' : ''"
                      >
                        {{ grantedKeys.has(item.key) ? 'Granted' : 'Off' }}
                      </span>
                      <input
                        type="checkbox"
                        class="rounded border-zinc-300 dark:border-zinc-600 text-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50"
                        :checked="grantedKeys.has(item.key)"
                        :disabled="checkboxDisabled(item.key)"
                        @change="onToggle(item.key, ($event.target as HTMLInputElement).checked)"
                      />
                    </label>
                  </li>
                </ul>
                <p
                  v-if="awardable.length === 0"
                  class="px-4 py-6 text-sm text-center text-zinc-500 dark:text-zinc-400"
                >
                  No manually assignable badges are configured.
                </p>
              </div>
            </template>
          </div>

          <div class="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/40 rounded-b-xl">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
              @click="emit('close')"
            >
              Done
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
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
const canRevokeAchievements = ref(true)

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
      can_revoke_achievements?: boolean
    }>('/api/admin/user/badges', {
      query: { userId: props.user.id },
      credentials: 'include',
    })
    signupNumber.value = res.signup_number ?? props.user.signup_number ?? null
    displayBadges.value = res.badges ?? []
    awardable.value = res.awardable ?? []
    grantedKeys.value = new Set(res.achievement_keys ?? [])
    canRevokeAchievements.value = res.can_revoke_achievements !== false
  } catch (e: any) {
    loadError.value = e?.data?.error || 'Failed to load badges'
  } finally {
    loading.value = false
  }
}

async function onToggle(badgeKey: string, shouldGrant: boolean) {
  if (!props.user?.id || togglingKey.value) return

  if (!shouldGrant && !canRevokeAchievements.value) {
    loadError.value = 'Only this admin can remove their own achievement badges.'
    return
  }

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

function checkboxDisabled(badgeKey: string): boolean {
  if (togglingKey.value === badgeKey) return true
  if (grantedKeys.value.has(badgeKey) && !canRevokeAchievements.value) return true
  return false
}
</script>
