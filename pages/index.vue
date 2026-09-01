<template>
  <div class="dashboard-page w-full min-w-0 space-y-5 sm:space-y-6">
    <header class="animate-slide-down flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-display">Dashboard</h1>
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your BetterSEQTA account and cloud settings backups
        </p>
      </div>
      <a
        v-if="showSurveyShortcut"
        :href="surveyUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-600 transition-all duration-200 hover:scale-105 hover:bg-primary-500/15 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 active:scale-95 dark:text-primary-400 dark:focus:ring-offset-zinc-900"
      >
        <SparklesIcon class="h-3.5 w-3.5" />
        Founding survey
      </a>
    </header>

    <!-- Founding 2500 banner -->
    <section
      v-if="showFoundingBanner"
      class="animate-fade-in rounded-2xl border border-primary-500/30 bg-gradient-to-r from-primary-500/10 via-amber-500/10 to-orange-500/10 p-4 shadow-md backdrop-blur-lg dark:border-primary-500/20 dark:from-primary-500/15 dark:via-amber-500/10 dark:to-orange-500/10 sm:p-5"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-zinc-900 dark:text-white">
            You're one of our first 2,500 Cloud members — share your feedback
          </p>
          <p v-if="auth.user.value?.signup_number" class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            You're user #{{ auth.user.value.signup_number.toLocaleString() }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <a
            :href="surveyUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 active:scale-95 dark:focus:ring-offset-zinc-900"
          >
            Take the survey
          </a>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-all duration-200 hover:scale-105 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 active:scale-95 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700/50 dark:focus:ring-offset-zinc-900"
            aria-label="Dismiss banner"
            @click="dismissFoundingBanner"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>

    <!-- Profile -->
    <section class="dash-card animate-fade-in p-4 sm:p-5">
      <div v-if="authLoading" class="flex justify-center py-6">
        <LoadingSpinner size="lg" />
      </div>
      <div v-else class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-center gap-3 sm:gap-4">
          <img
            :src="avatarUrl"
            alt=""
            class="h-14 w-14 shrink-0 rounded-full border-2 border-primary-500/40 object-cover"
          />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-lg font-semibold text-zinc-900 dark:text-white">
                {{ auth.user.value?.displayName || auth.user.value?.username || 'Account' }}
              </p>
              <ProfileBadgeStack
                :admin-level="auth.user.value?.admin_level ?? 0"
                :signup-number="auth.user.value?.signup_number"
                :badges="userBadges"
              />
            </div>
            <p class="truncate text-sm text-zinc-600 dark:text-zinc-400">{{ auth.user.value?.email }}</p>
            <p v-if="auth.user.value?.username" class="text-xs text-zinc-500">
              @{{ auth.user.value.username }}
            </p>
          </div>
        </div>
        <NuxtLink
          :to="settingsTabUrl('profile')"
          class="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700/50"
        >
          Edit profile
        </NuxtLink>
      </div>
    </section>

    <!-- Settings destinations (sync status inline — no duplicate cloud section) -->
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 animate-fade-in delay-100">
      <NuxtLink
        v-for="link in visibleLinks"
        :key="link.to"
        :to="link.to"
        class="dash-card group flex min-h-[5.5rem] items-start gap-3 p-4 transition-colors hover:border-primary-500/30 sm:p-5"
      >
        <div class="shrink-0 rounded-xl bg-primary-500/10 p-2.5 transition-colors group-hover:bg-primary-500/15">
          <component :is="link.icon" class="h-6 w-6 text-primary-500" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <h2 class="text-base font-semibold text-zinc-900 transition-colors group-hover:text-primary-500 dark:text-white">
              {{ link.title }}
            </h2>
            <ChevronRightIcon class="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" />
          </div>
          <p class="mt-1 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
            <LoadingSpinner v-if="link.sync && summaryLoading" size="sm" container-class="inline-flex align-middle" />
            <template v-else>{{ link.subtitle }}</template>
          </p>
        </div>
      </NuxtLink>
    </section>

    <p v-if="summaryError" class="text-sm text-red-500 dark:text-red-400">{{ summaryError }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSettings } from '~/composables/useSettings'
import { useAuth } from '~/composables/useAuth'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import ProfileBadgeStack from '~/components/badges/ProfileBadgeStack.vue'
import {
  UserCircleIcon,
  CogIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline'
import type { CloudSummaryResponse } from '~/composables/useSettings'
import { settingsTabUrl } from '~/composables/useTabPageUrl'

const { getCloudSummary } = useSettings()
const auth = useAuth()
const config = useRuntimeConfig()

const surveyUrl = computed(() => {
  const base = String(config.public.bsplusUrl || 'https://betterseqta.org').replace(/\/$/, '')
  return `${base}/surveys/founding-2500`
})

const summaryLoading = ref(true)
const summaryError = ref('')
const summary = ref<CloudSummaryResponse | null>(null)

const FOUNDING_BANNER_LEGACY_KEY = 'dismissed_founding_2500_banner'
const bannerDismissed = ref(false)
const surveyCompleted = ref(false)
const surveyActive = ref(true)
const surveyStatusLoading = ref(true)

function foundingBannerStorageKey(userId?: string | null) {
  return userId ? `dismissed_founding_2500_banner_${userId}` : FOUNDING_BANNER_LEGACY_KEY
}

function readBannerDismissed(userId?: string | null): boolean {
  if (!process.client || !userId) return false
  const key = foundingBannerStorageKey(userId)
  if (localStorage.getItem(key) === '1') return true
  if (localStorage.getItem(FOUNDING_BANNER_LEGACY_KEY) === '1') {
    localStorage.setItem(key, '1')
    localStorage.removeItem(FOUNDING_BANNER_LEGACY_KEY)
    return true
  }
  return false
}

function persistBannerDismissed(userId?: string | null) {
  if (!process.client || !userId) return
  localStorage.setItem(foundingBannerStorageKey(userId), '1')
  localStorage.removeItem(FOUNDING_BANNER_LEGACY_KEY)
}

const isEligibleForSurvey = computed(() => {
  const signupNumber = auth.user.value?.signup_number
  return signupNumber != null && signupNumber >= 1 && signupNumber <= 2500
})

const showFoundingBanner = computed(() => {
  if (surveyStatusLoading.value) return false
  if (!isEligibleForSurvey.value) return false
  if (!surveyActive.value) return false
  if (surveyCompleted.value) return false
  if (bannerDismissed.value) return false
  return true
})

const showSurveyShortcut = computed(() => {
  if (surveyStatusLoading.value) return false
  if (!isEligibleForSurvey.value) return false
  if (!surveyActive.value) return false
  if (surveyCompleted.value) return false
  return bannerDismissed.value
})

const authLoading = computed(() => auth.loading.value && !auth.user.value)

const userBadges = computed(() => auth.user.value?.badges ?? [])

const dismissFoundingBanner = () => {
  bannerDismissed.value = true
  persistBannerDismissed(auth.user.value?.id)
}

async function loadFoundingSurveyStatus() {
  surveyStatusLoading.value = true
  try {
    const userId = auth.user.value?.id
    bannerDismissed.value = readBannerDismissed(userId)

    if (!userId || !isEligibleForSurvey.value) {
      surveyCompleted.value = false
      return
    }

    const status = await $fetch<{
      eligible: boolean
      completed: boolean
      survey_active: boolean
    }>('/api/user/founding-survey-status', { credentials: 'include' })

    surveyCompleted.value = Boolean(status.completed)
    surveyActive.value = status.survey_active !== false

    if (surveyCompleted.value) {
      bannerDismissed.value = true
      persistBannerDismissed(userId)
    }
  } catch (error) {
    console.warn('Could not load founding survey status', error)
  } finally {
    surveyStatusLoading.value = false
  }
}

const avatarUrl = computed(() => {
  const u = auth.user.value
  if (u?.pfpUrl) return u.pfpUrl
  const seed = u?.id ?? u?.username ?? 'default'
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(seed))}`
})

const adminLevel = computed(() => auth.user.value?.admin_level ?? 0)

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

const bsPlusSubtitle = computed(() => {
  const at = summary.value?.bsplus?.updated_at
  if (!at) return 'No cloud backup yet'
  return `Last backup · ${formatDate(at)}`
})

const desqtaSubtitle = computed(() => {
  const d = summary.value?.desqta
  if (!d?.updated_at) return 'No cloud backup yet'
  const rev = d.revision != null ? ` · rev ${d.revision}` : ''
  return `Last updated · ${formatDate(d.updated_at)}${rev}`
})

type DashboardLink = {
  to: string
  title: string
  subtitle: string
  icon: typeof UserCircleIcon
  sync?: boolean
  adminOnly?: boolean
}

const dashboardLinks = computed((): DashboardLink[] => [
  {
    to: settingsTabUrl('profile'),
    title: 'Account settings',
    subtitle: 'Profile picture, display name, and username',
    icon: UserCircleIcon,
  },
  {
    to: settingsTabUrl('bqsettings'),
    title: 'BetterSEQTA+ settings',
    subtitle: bsPlusSubtitle.value,
    icon: SparklesIcon,
    sync: true,
  },
  {
    to: settingsTabUrl('dqsettings'),
    title: 'DesQTA settings',
    subtitle: desqtaSubtitle.value,
    icon: CogIcon,
    sync: true,
  },
  {
    to: '/admin',
    title: 'Admin panel',
    subtitle: 'Users, activity log, and system tools',
    icon: ShieldCheckIcon,
    adminOnly: true,
  },
])

const visibleLinks = computed(() =>
  dashboardLinks.value.filter((link) => !link.adminOnly || adminLevel.value > 0),
)

const loadSummary = async () => {
  summaryLoading.value = true
  summaryError.value = ''
  try {
    summary.value = await getCloudSummary()
  } catch (e) {
    summaryError.value = 'Could not load cloud sync status.'
    console.error(e)
  } finally {
    summaryLoading.value = false
  }
}

onMounted(async () => {
  if (!auth.user.value) {
    await auth.fetchUser()
  }
  await loadFoundingSurveyStatus()
  await loadSummary()
})

watch(
  () => auth.user.value?.id,
  async (userId, previousUserId) => {
    if (userId === previousUserId) return
    await loadFoundingSurveyStatus()
  },
)
</script>

<style scoped>
.dash-card {
  @apply rounded-2xl border border-zinc-200/50 bg-white/50 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-zinc-800/50;
}
</style>
