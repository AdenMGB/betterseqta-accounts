<template>
  <div class="settings-page w-full min-w-0">
    <h1 class="mb-4 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl font-display">Settings</h1>

    <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,240px)_1fr] lg:gap-6">
      <aside class="shrink-0">
        <div class="rounded-2xl border border-zinc-200/50 bg-white/50 p-3 shadow-xl backdrop-blur-lg dark:border-white/10 dark:bg-zinc-800/50 sm:p-4">
          <nav class="flex gap-2 overflow-x-auto admin-table-scroll lg:flex-col lg:overflow-visible">
            <button
              v-for="tab in tabs"
              :key="tab.name"
              @click="setActiveTab(tab.name)"
              :class="[
                'flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:w-full lg:shrink',
                activeTab === tab.name
                  ? 'bg-primary-500/10 text-primary-500'
                  : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-white'
              ]"
            >
              <component :is="tab.icon" class="h-5 w-5 shrink-0" />
              <span>{{ tab.label }}</span>
            </button>
          </nav>
        </div>
      </aside>

      <section
        class="settings-panel grid h-max min-w-0 overflow-hidden rounded-2xl border border-zinc-200/50 bg-white/50 shadow-xl backdrop-blur-lg dark:border-white/10 dark:bg-zinc-800/50"
        :class="activeTab === 'profile' ? 'grid-rows-[auto_minmax(0,1fr)_auto]' : 'grid-rows-[auto_minmax(0,1fr)]'"
      >
        <header class="border-b border-zinc-200/60 px-5 py-4 dark:border-zinc-700/60 sm:px-6">
          <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">{{ activeTabMeta.title }}</h2>
          <p v-if="activeTabMeta.description" class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {{ activeTabMeta.description }}
          </p>
        </header>

        <div
          class="min-h-0"
          :class="isCloudSettingsTab ? 'flex flex-col overflow-hidden px-5 py-5 sm:px-6' : 'overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 admin-table-scroll'"
        >
          <!-- Profile Settings -->
          <div v-if="activeTab === 'profile'" class="space-y-6">
            <form id="profile-form" @submit.prevent="updateProfile" class="space-y-6">
              <div class="flex items-center gap-4">
                <PfpStack
                  v-if="auth.user.value"
                  :user-id="auth.user.value.id"
                  :pfp-url="auth.user.value.pfpUrl"
                  :pfp-history="pfpHistory"
                  :cache-version="pfpCacheVersion"
                  can-edit
                  @edit="pfpEditorOpen = true"
                  @view="openPfpView"
                />
                <div>
                  <p class="text-sm text-zinc-600 dark:text-zinc-400">Profile pictures</p>
                  <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Click the pencil to change, restore, or clear.</p>
                </div>
              </div>

              <div class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20">
                <div class="divide-y divide-zinc-200/70 dark:divide-zinc-700/70">
                  <div class="px-4 py-4 sm:px-5">
                    <label for="displayName" class="form-label">Display Name</label>
                    <input v-model="displayName" id="displayName" type="text" required class="mt-2 w-full form-input">
                  </div>
                  <div class="px-4 py-4 sm:px-5">
                    <label for="username" class="form-label">Username</label>
                    <input v-model="username" id="username" type="text" required class="mt-2 w-full form-input">
                  </div>
                </div>
              </div>
            </form>

            <PfpEditorModal
              v-if="auth.user.value"
              :is-open="pfpEditorOpen"
              :user="settingsPfpUser"
              mode="self"
              :cache-version="pfpCacheVersion"
              @close="pfpEditorOpen = false"
              @view="openPfpView"
              @updated="onSettingsPfpUpdated"
            />
          </div>

          <!-- Account Settings -->
          <div v-else-if="activeTab === 'account'" class="space-y-8">
            <section>
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Change Email</h3>
              <div class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20">
                <div class="divide-y divide-zinc-200/70 dark:divide-zinc-700/70">
                  <div class="px-4 py-4 sm:px-5">
                    <label for="current-email" class="form-label">Current Email</label>
                    <input :value="auth.user.value?.email || ''" type="email" id="current-email" disabled class="mt-2 w-full form-input cursor-not-allowed opacity-60">
                  </div>
                  <div class="px-4 py-4 sm:px-5">
                    <label for="new-email" class="form-label">New Email</label>
                    <input v-model="newEmail" type="email" id="new-email" class="mt-2 w-full form-input" placeholder="Enter new email address">
                  </div>
                  <div class="px-4 py-4 sm:px-5">
                    <label for="email-password" class="form-label">Current Password</label>
                    <input v-model="emailPassword" type="password" id="email-password" class="mt-2 w-full form-input" placeholder="Enter your password to confirm">
                  </div>
                </div>
              </div>
              <div class="mt-4 flex items-center justify-end gap-3">
                <p v-if="emailSuccess" class="text-sm text-green-500">{{ emailSuccess }}</p>
                <p v-if="emailError" class="text-sm text-red-500 dark:text-red-400">{{ emailError }}</p>
                <button @click="changeEmail" :disabled="emailLoading || !newEmail || !emailPassword" class="form-button-primary">
                  <LoadingSpinner v-if="emailLoading" size="sm" />
                  <span v-else>Update Email</span>
                </button>
              </div>
            </section>

            <section>
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Change Password</h3>
              <div class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20">
                <div class="divide-y divide-zinc-200/70 dark:divide-zinc-700/70">
                  <div class="px-4 py-4 sm:px-5">
                    <label for="current-password" class="form-label">Current Password</label>
                    <input v-model="currentPassword" type="password" id="current-password" class="mt-2 w-full form-input">
                  </div>
                  <div class="px-4 py-4 sm:px-5">
                    <label for="new-password" class="form-label">New Password</label>
                    <input v-model="newPassword" type="password" id="new-password" class="mt-2 w-full form-input">
                  </div>
                </div>
              </div>
              <div class="mt-4 flex items-center justify-end gap-3">
                <p v-if="pwdSuccess" class="text-sm text-green-500">{{ pwdSuccess }}</p>
                <p v-if="pwdError" class="text-sm text-red-500 dark:text-red-400">{{ pwdError }}</p>
                <button @click="changePassword" :disabled="pwdLoading || !currentPassword || !newPassword" class="form-button-primary">
                  <LoadingSpinner v-if="pwdLoading" size="sm" />
                  <span v-else>Update Password</span>
                </button>
              </div>
            </section>
          </div>

          <!-- Sessions -->
          <div v-else-if="activeTab === 'sessions'" class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-zinc-600 dark:text-zinc-400">
                Devices and apps signed in to your account. Revoke any session you do not recognize.
              </p>
              <button
                type="button"
                @click="revokeOtherSessions"
                :disabled="sessionsLoading || revokingOthers || sessions.length <= 1"
                class="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {{ revokingOthers ? 'Signing out…' : 'Sign out all other devices' }}
              </button>
            </div>

            <div v-if="sessionsLoading" class="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>

            <div v-else-if="sessionsError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              {{ sessionsError }}
              <button type="button" @click="loadSessions" class="ml-2 underline">Retry</button>
            </div>

            <div v-else-if="!sessions.length" class="rounded-xl border border-zinc-200/80 bg-white/40 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700/60 dark:bg-zinc-950/20 dark:text-zinc-400">
              No active sessions found.
            </div>

            <ul v-else class="space-y-3">
              <li
                v-for="session in sessions"
                :key="session.id"
                class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20"
              >
                <div class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-medium text-zinc-900 dark:text-white">{{ session.label }}</p>
                      <span
                        v-if="session.is_current"
                        class="rounded-full bg-primary-500/10 px-2 py-0.5 text-xs font-medium text-primary-600 dark:text-primary-400"
                      >
                        This device
                      </span>
                    </div>
                    <p v-if="session.device_name && session.device_name !== session.label" class="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {{ session.device_name }}
                    </p>
                    <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Last active {{ formatSessionTime(session.last_used_at || session.created_at) }}
                      <span v-if="session.last_ip"> · {{ session.last_ip }}</span>
                    </p>
                  </div>
                  <button
                    v-if="!session.is_current"
                    type="button"
                    @click="revokeSession(session.id)"
                    :disabled="revokingSessionId === session.id"
                    class="shrink-0 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    {{ revokingSessionId === session.id ? 'Signing out…' : 'Sign out' }}
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <!-- BetterSEQTA+ Settings -->
          <div v-else-if="activeTab === 'bsplus-settings'" class="flex min-h-0 flex-1 flex-col">
            <div v-if="bsPlusLoading && !bsPlusFormReady" class="flex flex-1 items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>

            <div v-else-if="bsPlusError && !bsPlusFormReady" class="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <p class="mb-4 text-red-500">{{ bsPlusError }}</p>
              <button type="button" @click="loadBsPlusSettings" class="rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600">Retry</button>
            </div>

            <SettingsBsPlusSettingsForm
              v-else
              ref="bsPlusFormRef"
              class="flex min-h-0 flex-1 flex-col"
              :initial-data="bsPlusData"
              :loading="bsPlusLoading"
              :error="bsPlusError"
              :success="bsPlusSuccess"
              @save="saveBsPlusSettings"
              @discard="onBsPlusDiscard"
            />
          </div>

          <!-- DesQTA Settings -->
          <div v-else-if="activeTab === 'bs-settings'" class="flex min-h-0 flex-1 flex-col">
            <div v-if="bsLoading && !desqtaFormReady" class="flex flex-1 items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>

            <div v-else-if="bsError && !desqtaFormReady" class="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <p class="mb-4 text-red-500">{{ bsError }}</p>
              <button type="button" @click="loadBsSettings" class="rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600">Retry</button>
            </div>

            <SettingsDesQTASettingsForm
              v-else
              ref="desqtaFormRef"
              class="flex min-h-0 flex-1 flex-col"
              :initial-data="desqtaData"
              :loading="bsLoading"
              :error="bsError"
              :success="bsSuccess"
              @save="saveBsSettings"
              @discard="onDesqtaDiscard"
            />
          </div>
        </div>

        <footer
          v-if="activeTab === 'profile'"
          class="flex items-center justify-end gap-3 border-t border-zinc-200/60 px-5 py-4 dark:border-zinc-700/60 sm:px-6"
        >
          <p v-if="success" class="mr-auto text-sm text-green-500">{{ success }}</p>
          <p v-if="error" class="text-sm text-red-500 dark:text-red-400">{{ error }}</p>
          <button type="submit" form="profile-form" :disabled="loading" class="form-button-primary">
            <LoadingSpinner v-if="loading" size="sm" />
            <span v-else>Save Changes</span>
          </button>
        </footer>
      </section>
    </div>
  </div>

  <!-- Teleport avoids clipping from backdrop-blur/filter ancestors -->
  <Teleport to="body">
    <div
      v-if="pfpViewerSrc"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      @click="pfpViewerSrc = null"
    >
      <button
        type="button"
        class="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
        aria-label="Close"
        @click="pfpViewerSrc = null"
      >
        <XMarkIcon class="w-8 h-8" />
      </button>
      <img
        :src="pfpViewerSrc"
        alt=""
        class="max-w-[min(92vw,1200px)] max-h-[min(88vh,1200px)] w-auto h-auto object-contain rounded-lg shadow-2xl"
        @click.stop
      />
    </div>
  </Teleport>
</template>

<style scoped>
.settings-panel {
  max-height: calc(100dvh - 15.5rem);
}

@media (min-width: 768px) {
  .settings-panel {
    max-height: calc(100dvh - 11.5rem);
  }
}

.form-label {
  @apply text-sm font-medium text-zinc-700 dark:text-zinc-300;
  display: block;
  line-height: 1.5;
}

.form-input {
  @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200;
}

.form-select {
  @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200;
  /* Fix alignment issues in Firefox and ensure consistent rendering */
  min-height: 2.5rem;
  height: 2.5rem;
  line-height: 1.5;
  display: block;
  /* Ensure consistent padding across browsers - Firefox needs explicit values */
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.75rem;
  padding-right: 2.5rem;
  /* Align text properly */
  vertical-align: middle;
  box-sizing: border-box;
}

.form-button-primary {
  @apply flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, watch, type ComponentPublicInstance } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useSettings } from '~/composables/useSettings'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import PfpStack from '~/components/PfpStack.vue'
import PfpEditorModal from '~/components/PfpEditorModal.vue'
import { withPfpCacheBust } from '~/utils/pfp'
import { useTabPageUrl, SETTINGS_TAB_PAGE } from '~/composables/useTabPageUrl'
import { UserCircleIcon, ShieldCheckIcon, CogIcon, SparklesIcon, XMarkIcon, DevicePhoneMobileIcon } from '@heroicons/vue/24/outline'

const auth = useAuth()
const { getSettings, syncSettings, getBsPlusSync, putBsPlusSync } = useSettings()

const displayName = ref('')
const username = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const pfpHistory = ref<any[]>([])
const pfpEditorOpen = ref(false)
const pfpViewerSrc = ref<string | null>(null)
const pfpCacheVersion = ref<number | string>(Date.now())

const settingsPfpUser = computed(() => {
  if (!auth.user.value) return null
  return {
    id: auth.user.value.id,
    username: auth.user.value.username,
    displayName: auth.user.value.displayName,
    pfpUrl: auth.user.value.pfpUrl,
    pfpHash: auth.user.value.pfpHash,
    pfpHistory: pfpHistory.value,
  }
})

const openPfpView = (src: string) => {
  pfpViewerSrc.value = withPfpCacheBust(src, pfpCacheVersion.value)
}

const loadPfpHistory = async () => {
  try {
    const res = await $fetch<{ pfpHistory: any[] }>('/api/user/pfp/history', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    pfpHistory.value = res.pfpHistory
  } catch {
    pfpHistory.value = []
  }
}

const onSettingsPfpUpdated = async (payload: { pfpUrl: string | null; pfpHash: string | null; pfpHistory: any[] }) => {
  pfpCacheVersion.value = payload.pfpHash ?? Date.now()
  pfpHistory.value = payload.pfpHistory
  if (auth.user.value) {
    auth.user.value.pfpUrl = payload.pfpUrl
    auth.user.value.pfpHash = payload.pfpHash
  }
  await auth.fetchUser()
}

const { activeTab, setActiveTab } = useTabPageUrl(SETTINGS_TAB_PAGE)
const tabs = [
  { name: 'profile', label: 'Profile', icon: UserCircleIcon },
  { name: 'account', label: 'Account', icon: ShieldCheckIcon },
  { name: 'sessions', label: 'Sessions', icon: DevicePhoneMobileIcon },
  { name: 'bsplus-settings', label: 'BetterSEQTA+ Settings', icon: SparklesIcon },
  { name: 'bs-settings', label: 'DesQTA Settings', icon: CogIcon },
]

const activeTabMeta = computed(() => {
  switch (activeTab.value) {
    case 'profile':
      return { title: 'Profile Settings', description: null }
    case 'account':
      return { title: 'Account Security', description: null }
    case 'sessions':
      return {
        title: 'Active Sessions',
        description: 'Manage devices and apps that are signed in to your account.',
      }
    case 'bsplus-settings':
      return {
        title: 'BetterSEQTA+ Settings',
        description: 'Cloud backup for the browser extension (same data as sync from the extension). DesQTA desktop app settings are separate below.',
      }
    case 'bs-settings':
      return { title: 'DesQTA Settings', description: 'Cloud backup for the DesQTA desktop app.' }
    default:
      return { title: 'Settings', description: null }
  }
})

const isCloudSettingsTab = computed(() =>
  activeTab.value === 'bsplus-settings' || activeTab.value === 'bs-settings',
)

// DesQTA cloud settings
const desqtaFormRef = ref<ComponentPublicInstance<{
  loadFromApi: (data: Record<string, unknown>) => void
  buildPayload: () => Record<string, unknown>
  commitSave: (patch?: Record<string, unknown>) => void
}> | null>(null)
const desqtaData = ref<Record<string, unknown> | null>(null)
const desqtaFormReady = ref(false)
const bsLoading = ref(false)
const bsError = ref('')
const bsSuccess = ref('')

// BetterSEQTA+ extension cloud backup
const bsPlusFormRef = ref<ComponentPublicInstance<{
  loadFromApi: (data: Record<string, unknown>) => void
  buildPayload: () => Record<string, unknown>
  commitSave: (patch?: Record<string, unknown>) => void
}> | null>(null)
const bsPlusData = ref<Record<string, unknown> | null>(null)
const bsPlusFormReady = ref(false)
const bsPlusLoading = ref(false)
const bsPlusError = ref('')
const bsPlusSuccess = ref('')

// Password Change State
const currentPassword = ref('')
const newPassword = ref('')
const pwdLoading = ref(false)
const pwdError = ref('')
const pwdSuccess = ref('')

// Email Change State
const newEmail = ref('')
const emailPassword = ref('')
const emailLoading = ref(false)
const emailError = ref('')
const emailSuccess = ref('')

type SessionRow = {
  id: string
  platform: string
  device_name: string | null
  client_id: string | null
  client_name: string | null
  label: string
  user_agent: string | null
  created_at: number
  last_used_at: number | null
  last_ip: string | null
  is_current: boolean
}

const sessions = ref<SessionRow[]>([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const revokingSessionId = ref<string | null>(null)
const revokingOthers = ref(false)

const formatSessionTime = (unixSec: number | null) => {
  if (!unixSec) return 'unknown'
  return new Date(unixSec * 1000).toLocaleString()
}

const sessionAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const loadSessions = async () => {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const res = await $fetch<{ sessions: SessionRow[] }>('/api/auth/sessions', {
      credentials: 'include',
      headers: sessionAuthHeaders(),
    })
    sessions.value = res.sessions || []
  } catch (err: any) {
    sessionsError.value = err?.data?.error || err?.message || 'Failed to load sessions'
    sessions.value = []
  } finally {
    sessionsLoading.value = false
  }
}

const revokeSession = async (sessionId: string) => {
  revokingSessionId.value = sessionId
  try {
    await $fetch(`/api/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: sessionAuthHeaders(),
    })
    await loadSessions()
  } catch (err: any) {
    sessionsError.value = err?.data?.error || err?.message || 'Failed to revoke session'
  } finally {
    revokingSessionId.value = null
  }
}

const revokeOtherSessions = async () => {
  revokingOthers.value = true
  sessionsError.value = ''
  try {
    await $fetch('/api/auth/sessions/revoke-others', {
      method: 'POST',
      credentials: 'include',
      headers: sessionAuthHeaders(),
    })
    await loadSessions()
  } catch (err: any) {
    sessionsError.value = err?.data?.error || err?.message || 'Failed to sign out other devices'
  } finally {
    revokingOthers.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'sessions') {
    loadSessions()
  }
})

onMounted(async () => {
  if (auth.user.value) {
    displayName.value = auth.user.value.displayName || ''
    username.value = auth.user.value.username || ''
  } else {
    auth.fetchUser().then(() => {
      displayName.value = auth.user.value?.displayName || ''
      username.value = auth.user.value?.username || ''
    })
  }
  
  await Promise.all([loadBsSettings(), loadBsPlusSettings(), loadPfpHistory()])
  if (activeTab.value === 'sessions') {
    await loadSessions()
  }
})

const loadBsSettings = async () => {
  bsLoading.value = true
  bsError.value = ''
  desqtaFormReady.value = false
  try {
    const settings = await getSettings()
    desqtaData.value = (settings || {}) as Record<string, unknown>
    desqtaFormRef.value?.loadFromApi(desqtaData.value)
    desqtaFormReady.value = true
  } catch (e) {
    bsError.value = 'Failed to load settings.'
    console.error('Failed to load DesQTA settings', e)
  } finally {
    bsLoading.value = false
  }
}

const loadBsPlusSettings = async () => {
  bsPlusLoading.value = true
  bsPlusError.value = ''
  bsPlusFormReady.value = false
  try {
    const { data } = await getBsPlusSync()
    bsPlusData.value = (data || {}) as Record<string, unknown>
    bsPlusFormRef.value?.loadFromApi(bsPlusData.value)
    bsPlusFormReady.value = true
  } catch (e) {
    bsPlusError.value = 'Failed to load settings.'
    console.error('Failed to load BetterSEQTA+ settings', e)
  } finally {
    bsPlusLoading.value = false
  }
}

const updateProfile = async () => {
  error.value = ''
  success.value = ''
  loading.value = true
  
  try {
    await $fetch('/api/user/update', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: {
        displayName: displayName.value,
        username: username.value,
      },
    })
    
    success.value = 'Profile updated successfully.'
    await auth.fetchUser()

  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Update failed.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const onDesqtaDiscard = () => {
  bsSuccess.value = ''
  bsError.value = ''
}

const onBsPlusDiscard = () => {
  bsPlusSuccess.value = ''
  bsPlusError.value = ''
}

const saveBsSettings = async () => {
  if (!desqtaFormRef.value) return
  bsLoading.value = true
  bsError.value = ''
  bsSuccess.value = ''

  try {
    const patch = desqtaFormRef.value.buildPayload()
    if (Object.keys(patch).length === 0) {
      bsSuccess.value = 'No changes to save.'
      setTimeout(() => (bsSuccess.value = ''), 3000)
      return
    }
    const saved = await syncSettings(patch)
    desqtaFormRef.value.commitSave(patch)
    if (saved && typeof saved === 'object') {
      desqtaData.value = saved as Record<string, unknown>
    }
    bsSuccess.value = 'Settings saved to cloud!'
    setTimeout(() => (bsSuccess.value = ''), 3000)
  } catch (e) {
    bsError.value = 'Failed to save settings.'
    console.error(e)
  } finally {
    bsLoading.value = false
  }
}

const saveBsPlusSettings = async () => {
  if (!bsPlusFormRef.value) return
  bsPlusLoading.value = true
  bsPlusError.value = ''
  bsPlusSuccess.value = ''

  try {
    const payload = bsPlusFormRef.value.buildPayload()
    if (Object.keys(payload).length === 0) {
      bsPlusSuccess.value = 'No changes to save.'
      setTimeout(() => (bsPlusSuccess.value = ''), 3000)
      return
    }
    await putBsPlusSync(payload)
    bsPlusFormRef.value.commitSave(payload)
    bsPlusSuccess.value = 'BetterSEQTA+ cloud settings saved!'
    setTimeout(() => (bsPlusSuccess.value = ''), 3000)
  } catch (e) {
    bsPlusError.value = 'Failed to save settings.'
    console.error(e)
  } finally {
    bsPlusLoading.value = false
  }
}

const changePassword = async () => {
    pwdLoading.value = true;
    pwdError.value = '';
    pwdSuccess.value = '';

    try {
        await $fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: {
                currentPassword: currentPassword.value,
                newPassword: newPassword.value
            }
        });
        
        pwdSuccess.value = 'Password changed successfully.';
        currentPassword.value = '';
        newPassword.value = '';
    } catch (e: any) {
        pwdError.value = e?.data?.error || 'Failed to change password.';
    } finally {
        pwdLoading.value = false;
    }
}

const changeEmail = async () => {
    emailLoading.value = true;
    emailError.value = '';
    emailSuccess.value = '';

    try {
        const response = await $fetch<{ success: boolean; email: string }>('/api/auth/change-email', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: {
                newEmail: newEmail.value,
                password: emailPassword.value
            }
        });
        
        emailSuccess.value = 'Email changed successfully.';
        newEmail.value = '';
        emailPassword.value = '';
        
        // Refresh user data to get updated email
        await auth.fetchUser();
    } catch (e: any) {
        emailError.value = e?.data?.error || 'Failed to change email.';
    } finally {
        emailLoading.value = false;
    }
}
</script>
