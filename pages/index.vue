<template>
  <div class="w-full min-w-0 max-w-4xl mx-auto space-y-6 sm:space-y-8">
    <div class="text-center animate-slide-down">
      <h1 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-display mb-2">Dashboard</h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        Your BetterSEQTA account, cloud backups, and quick links
      </p>
    </div>

    <!-- Account snapshot -->
    <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 animate-fade-in">
      <div v-if="authLoading" class="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
      <div v-else class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-4">
          <img
            :src="auth.user.value?.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.user.value?.id ?? auth.user.value?.username ?? 'default'}`"
            alt=""
            class="w-16 h-16 rounded-full object-cover border-2 border-primary-500/50"
          />
          <div>
            <p class="text-lg font-semibold text-zinc-900 dark:text-white">
              {{ auth.user.value?.displayName || auth.user.value?.username || 'Account' }}
            </p>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">{{ auth.user.value?.email }}</p>
            <p v-if="auth.user.value?.username" class="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
              @{{ auth.user.value.username }}
            </p>
          </div>
        </div>
        <NuxtLink
          to="/settings#profile"
          class="inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
        >
          Edit profile
        </NuxtLink>
      </div>
    </div>

    <!-- Cloud sync status -->
    <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 animate-fade-in delay-100">
      <h2 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Cloud sync</h2>
      <div v-if="summaryLoading" class="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-700/50">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">BetterSEQTA+ (extension)</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Browser extension backup</p>
          <p class="text-sm text-zinc-700 dark:text-zinc-300 mt-2">
            <template v-if="summary?.bsplus?.updated_at">
              Last backup: {{ formatDate(summary.bsplus.updated_at) }}
            </template>
            <template v-else> No cloud backup yet </template>
          </p>
          <NuxtLink to="/settings#bsplus-settings" class="text-sm text-primary-600 dark:text-primary-400 hover:underline mt-2 inline-block">
            Manage BetterSEQTA+ settings
          </NuxtLink>
        </div>
        <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-700/50">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">DesQTA</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Desktop app cloud settings</p>
          <p class="text-sm text-zinc-700 dark:text-zinc-300 mt-2">
            <template v-if="summary?.desqta?.updated_at">
              Last updated: {{ formatDate(summary.desqta.updated_at) }}
              <span v-if="summary.desqta.revision != null" class="text-zinc-500"> · rev {{ summary.desqta.revision }}</span>
            </template>
            <template v-else> No DesQTA settings yet </template>
          </p>
          <NuxtLink to="/settings#bs-settings" class="text-sm text-primary-600 dark:text-primary-400 hover:underline mt-2 inline-block">
            Manage DesQTA settings
          </NuxtLink>
        </div>
      </div>
      <p v-if="summaryError" class="text-sm text-red-500 dark:text-red-400 mt-3">{{ summaryError }}</p>
    </div>

    <!-- Quick Links -->
    <div>
      <h2 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Quick links</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in delay-100">
        <NuxtLink to="/settings#profile" class="group">
          <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 cursor-pointer h-full">
            <div class="flex items-start gap-4">
              <div class="p-3 bg-primary-500/10 rounded-xl group-hover:bg-primary-500/20 transition-colors duration-200">
                <UserCircleIcon class="w-8 h-8 text-primary-500" />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-primary-500 transition-colors duration-200">Account Settings</h3>
                <p class="text-sm text-zinc-600 dark:text-zinc-400">Profile picture, display name, and username</p>
              </div>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/settings#bsplus-settings" class="group">
          <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 cursor-pointer h-full">
            <div class="flex items-start gap-4">
              <div class="p-3 bg-primary-500/10 rounded-xl group-hover:bg-primary-500/20 transition-colors duration-200">
                <SparklesIcon class="w-8 h-8 text-primary-500" />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-primary-500 transition-colors duration-200">BetterSEQTA+ Settings</h3>
                <p class="text-sm text-zinc-600 dark:text-zinc-400">Extension cloud backup and preferences</p>
              </div>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/settings#bs-settings" class="group">
          <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 cursor-pointer h-full">
            <div class="flex items-start gap-4">
              <div class="p-3 bg-primary-500/10 rounded-xl group-hover:bg-primary-500/20 transition-colors duration-200">
                <CogIcon class="w-8 h-8 text-primary-500" />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-primary-500 transition-colors duration-200">DesQTA Settings</h3>
                <p class="text-sm text-zinc-600 dark:text-zinc-400">DesQTA desktop app cloud settings</p>
              </div>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink v-if="auth.user.value?.is_admin" to="/admin" class="group">
          <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 cursor-pointer h-full">
            <div class="flex items-start gap-4">
              <div class="p-3 bg-primary-500/10 rounded-xl group-hover:bg-primary-500/20 transition-colors duration-200">
                <ShieldCheckIcon class="w-8 h-8 text-primary-500" />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-primary-500 transition-colors duration-200">Admin Panel</h3>
                <p class="text-sm text-zinc-600 dark:text-zinc-400">Manage users and system settings</p>
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettings } from '~/composables/useSettings'
import { useAuth } from '~/composables/useAuth'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import { UserCircleIcon, CogIcon, ShieldCheckIcon, SparklesIcon } from '@heroicons/vue/24/outline'
import type { CloudSummaryResponse } from '~/composables/useSettings'

const { getCloudSummary } = useSettings()
const auth = useAuth()

const summaryLoading = ref(true)
const summaryError = ref('')
const summary = ref<CloudSummaryResponse | null>(null)

const authLoading = computed(() => auth.loading.value && !auth.user.value)

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

