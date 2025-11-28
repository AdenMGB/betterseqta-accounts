<template>
  <div class="max-w-4xl mx-auto space-y-8 pb-20">
    <div class="text-center animate-slide-down">
      <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display mb-2">Dashboard</h1>
      <p class="text-zinc-600 dark:text-zinc-400">Manage your BetterSEQTA+ cloud settings</p>
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
            <div class="form-group">
              <label class="form-label">Theme</label>
              <select v-model="settings.theme" class="form-select">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Accent Color</label>
              <div class="flex items-center gap-3">
                <input type="color" v-model="settings.accent_color" class="w-10 h-10 rounded border border-gray-300 cursor-pointer p-1 bg-transparent" />
                <input type="text" v-model="settings.accent_color" class="form-input flex-1" />
              </div>
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
            <div class="form-group pt-2">
              <label class="form-label">Gemini API Key</label>
              <input type="password" v-model="settings.gemini_api_key" class="form-input" placeholder="Enter API Key" />
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
import { SwatchIcon, SparklesIcon, CpuChipIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'

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
