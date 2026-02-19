<template>
  <div class="max-w-4xl mx-auto space-y-8 pb-20">
    <div class="text-center animate-slide-down">
      <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display mb-2">Dashboard</h1>
      <p class="text-zinc-600 dark:text-zinc-400">Manage your DesQTA cloud settings</p>
    </div>

    <!-- Quick Links -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in delay-100">
      <!-- Account Settings -->
      <NuxtLink to="/settings#profile" class="group">
        <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 cursor-pointer h-full">
          <div class="flex items-start gap-4">
            <div class="p-3 bg-primary-500/10 rounded-xl group-hover:bg-primary-500/20 transition-colors duration-200">
              <UserCircleIcon class="w-8 h-8 text-primary-500" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-primary-500 transition-colors duration-200">Account Settings</h3>
              <p class="text-sm text-zinc-600 dark:text-zinc-400">Update your profile picture, display name, and username</p>
            </div>
          </div>
        </div>
      </NuxtLink>

      <!-- DesQTA Settings -->
      <NuxtLink to="/settings#bs-settings" class="group">
        <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 cursor-pointer h-full">
          <div class="flex items-start gap-4">
            <div class="p-3 bg-primary-500/10 rounded-xl group-hover:bg-primary-500/20 transition-colors duration-200">
              <CogIcon class="w-8 h-8 text-primary-500" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-primary-500 transition-colors duration-200">DesQTA Settings</h3>
              <p class="text-sm text-zinc-600 dark:text-zinc-400">Configure your DesQTA cloud settings and preferences</p>
            </div>
          </div>
        </div>
      </NuxtLink>

      <!-- Admin Panel (conditional) -->
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

    <!-- Settings Editor -->
    <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8 animate-fade-in">
      <div v-if="loading" class="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
      
      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-500 mb-4">{{ error }}</p>
        <button @click="loadSettings" class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Retry</button>
      </div>

      <div v-else class="space-y-8">
        <!-- Appearance -->
        <section>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <SwatchIcon class="w-5 h-5 text-primary-500" /> Appearance
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
              <span class="text-zinc-700 dark:text-zinc-300 capitalize">{{ settings.theme || '—' }}</span>
            </div>
            <div class="form-group">
              <label class="form-label">Accent Color</label>
              <ColorPicker v-model="settings.accent_color" />
            </div>
            <div class="form-group">
              <label class="form-label">Current Theme</label>
              <input v-model="settings.current_theme" type="text" class="form-input" placeholder="e.g. sunset" />
            </div>
            <div class="form-group">
              <label class="form-label">Zoom Level</label>
              <input v-model.number="settings.zoom_level" type="number" class="form-input" placeholder="100" min="80" max="150" step="5" />
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Page zoom percentage (80–150). Leave empty for default.</p>
            </div>
             <div class="form-group flex items-center gap-3 md:col-span-2">
               <Switch v-model="settings.enhanced_animations" />
               <span class="text-zinc-700 dark:text-zinc-300">Enhanced Animations</span>
            </div>
          </div>
        </section>

        <!-- Features -->
        <section>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <SparklesIcon class="w-5 h-5 text-primary-500" /> Features
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Weather Widget</span>
               <Switch v-model="settings.weather_enabled" />
            </div>
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Reminders</span>
               <Switch v-model="settings.reminders_enabled" />
            </div>
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">School Picture</span>
               <Switch v-model="settings.disable_school_picture" :invert="true" />
            </div>
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Global Search</span>
               <Switch v-model="settings.global_search_enabled" />
            </div>
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Separate RSS Feed</span>
               <Switch v-model="settings.separate_rss_feed" />
            </div>
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Quiz Generator</span>
               <Switch v-model="settings.quiz_generator_enabled" />
            </div>
            <div class="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
              <span class="text-zinc-500 dark:text-zinc-400 text-sm block">Weather City</span>
              <p class="text-zinc-900 dark:text-white font-medium mt-1">{{ settings.weather_city || '—' }}</p>
            </div>
            <div class="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
              <span class="text-zinc-500 dark:text-zinc-400 text-sm block">Weather Country</span>
              <p class="text-zinc-900 dark:text-white font-medium mt-1">{{ settings.weather_country || '—' }}</p>
            </div>
             <div class="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-500 dark:text-zinc-400 text-sm block">Force Use Location</span>
               <p class="text-zinc-900 dark:text-white font-medium mt-1">{{ settings.force_use_location ? 'Yes' : 'No' }}</p>
            </div>
          </div>
        </section>

        <!-- AI & Analytics -->
        <section>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <CpuChipIcon class="w-5 h-5 text-primary-500" /> AI & Analytics
          </h2>
          <div class="space-y-4">
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">AI Integrations</span>
               <Switch v-model="settings.ai_integrations_enabled" />
            </div>
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Grade Analyser</span>
               <Switch v-model="settings.grade_analyser_enabled" />
            </div>
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Lesson Summary Analyser</span>
               <Switch v-model="settings.lesson_summary_analyser_enabled" />
            </div>
            <div class="form-group">
              <label class="form-label">AI Provider</label>
              <select v-model="settings.ai_provider" class="form-select">
                <option value="gemini">Gemini</option>
                <option value="cerebras">Cerebras</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Gemini API Key</label>
              <input type="password" name="gemini_api_key" autocomplete="new-password" v-model="settings.gemini_api_key" class="form-input" placeholder="Enter API Key" />
            </div>
            <div v-if="settings.ai_provider === 'cerebras'" class="form-group">
              <label class="form-label">Cerebras API Key</label>
              <input type="password" name="cerebras_api_key" autocomplete="new-password" v-model="settings.cerebras_api_key" class="form-input" placeholder="Enter Cerebras API Key" />
            </div>
          </div>
        </section>

        <!-- Notifications -->
        <section>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <BellIcon class="w-5 h-5 text-primary-500" /> Notifications
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
               <span class="text-zinc-700 dark:text-zinc-300 font-medium">Auto Dismiss Message Notifications</span>
               <Switch v-model="settings.auto_dismiss_message_notifications" />
            </div>
          </div>
        </section>

        <!-- General -->
        <section>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <GlobeAltIcon class="w-5 h-5 text-primary-500" /> General
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="form-group">
              <label class="form-label">Language</label>
              <select v-model="settings.language" class="form-select">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
          </div>
        </section>

        <!-- Developer -->
        <section class="border-t border-zinc-200 dark:border-zinc-700 pt-6">
           <button @click="showDevOptions = !showDevOptions" class="w-full flex items-center justify-between text-lg font-semibold text-zinc-900 dark:text-white mb-4 hover:text-primary-500 transition-colors duration-200 focus:outline-none">
             <span>Developer Options</span>
             <component :is="showDevOptions ? ChevronUpIcon : ChevronDownIcon" class="w-5 h-5" />
           </button>
           <div v-if="showDevOptions" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              <div class="flex items-center justify-between p-3 rounded-lg">
                 <span class="text-sm text-zinc-600 dark:text-zinc-400">Hide Sensitive Info</span>
                 <Switch v-model="settings.dev_sensitive_info_hider" />
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg">
                 <span class="text-sm text-zinc-600 dark:text-zinc-400">Force Offline Mode</span>
                 <Switch v-model="settings.dev_force_offline_mode" />
              </div>
           </div>
        </section>

        <!-- Save Button -->
        <div class="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700 sticky bottom-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur p-4 -mx-8 -mb-8 rounded-b-2xl z-10">
           <p v-if="saveSuccess" class="mr-4 text-green-500 font-medium self-center animate-fade-in">Settings saved!</p>
           <p v-if="error && !loading" class="mr-4 text-red-500 dark:text-red-400 font-medium self-center animate-fade-in">{{ error }}</p>
           <button @click="saveSettings" :disabled="saving" class="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-6 rounded-lg transition-all duration-200 shadow-lg shadow-primary-500/30 flex items-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
             <LoadingSpinner v-if="saving" size="sm" class="text-white" />
             <span v-else>Save Changes</span>
           </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettings } from '~/composables/useSettings'
import { useAuth } from '~/composables/useAuth'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import Switch from '~/components/ui/Switch.vue'
import ColorPicker from '~/components/ui/ColorPicker.vue'
import { SwatchIcon, SparklesIcon, CpuChipIcon, ChevronDownIcon, ChevronUpIcon, UserCircleIcon, CogIcon, ShieldCheckIcon, BellIcon, GlobeAltIcon } from '@heroicons/vue/24/outline'

const { getSettings, syncSettings } = useSettings()
const auth = useAuth()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saveSuccess = ref(false)
const showDevOptions = ref(false)

const settings = ref<any>({})

const loadSettings = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await getSettings()
    settings.value = data || {}
  } catch (e) {
    error.value = 'Failed to load settings.'
    console.error(e)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  saveSuccess.value = false
  error.value = ''
  try {
    await syncSettings(settings.value)
    saveSuccess.value = true
    setTimeout(() => saveSuccess.value = false, 3000)
  } catch (e) {
    error.value = 'Failed to save settings.'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (auth.user.value) {
    loadSettings()
  } else {
    auth.fetchUser().then(() => {
       if(auth.user.value) loadSettings()
    })
  }
})
</script>

<style scoped>
.form-group {
  @apply flex flex-col gap-1.5;
}
.form-label {
  @apply text-sm font-medium text-zinc-700 dark:text-zinc-300;
}
.form-input, .form-select {
  @apply w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200;
}
</style>
