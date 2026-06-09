<template>
  <div class="dashboard-page w-full min-w-0 space-y-5 sm:space-y-6">
    <header class="animate-slide-down">
      <h1 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-display">Dashboard</h1>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Your BetterSEQTA account and cloud settings backups
      </p>
    </header>

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
              <span
                v-if="roleLabel"
                :class="roleBadgeClass"
              >
                {{ roleLabel }}
              </span>
            </div>
            <p class="truncate text-sm text-zinc-600 dark:text-zinc-400">{{ auth.user.value?.email }}</p>
            <p v-if="auth.user.value?.username" class="text-xs text-zinc-500">
              @{{ auth.user.value.username }}
            </p>
          </div>
        </div>
        <NuxtLink
          to="/settings#profile"
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
import { ref, computed, onMounted } from 'vue'
import { useSettings } from '~/composables/useSettings'
import { useAuth } from '~/composables/useAuth'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import {
  UserCircleIcon,
  CogIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline'
import type { CloudSummaryResponse } from '~/composables/useSettings'

const { getCloudSummary } = useSettings()
const auth = useAuth()

const summaryLoading = ref(true)
const summaryError = ref('')
const summary = ref<CloudSummaryResponse | null>(null)

const authLoading = computed(() => auth.loading.value && !auth.user.value)

const avatarUrl = computed(() => {
  const u = auth.user.value
  if (u?.pfpUrl) return u.pfpUrl
  const seed = u?.id ?? u?.username ?? 'default'
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(seed))}`
})

const adminLevel = computed(() => auth.user.value?.admin_level ?? 0)

const roleLabel = computed(() => {
  const level = adminLevel.value
  if (level <= 0) return ''
  if (level >= 3) return 'Senior Admin'
  if (level === 2) return 'Middle Admin'
  if (level === 1) return 'Junior Admin'
  return `Level ${level} Admin`
})

const roleBadgeClass = computed(() => {
  const level = adminLevel.value
  const base = 'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'
  if (level >= 3) return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200`
  if (level >= 1) return `${base} bg-primary-500/15 text-primary-600 dark:text-primary-400`
  return base
})

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
    to: '/settings#profile',
    title: 'Account settings',
    subtitle: 'Profile picture, display name, and username',
    icon: UserCircleIcon,
  },
  {
    to: '/settings#bsplus-settings',
    title: 'BetterSEQTA+ settings',
    subtitle: bsPlusSubtitle.value,
    icon: SparklesIcon,
    sync: true,
  },
  {
    to: '/settings#bs-settings',
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
  await loadSummary()
})
</script>

<style scoped>
.dash-card {
  @apply rounded-2xl border border-zinc-200/50 bg-white/50 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-zinc-800/50;
}
</style>
