<template>
  <div class="space-y-8">
    <!-- Appearance -->
    <section v-if="hasSection('appearance')">
      <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <SwatchIcon class="w-5 h-5 text-primary-500" /> Appearance
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <template v-for="key in getSectionKeys('appearance')" :key="key">
          <div v-if="key === 'theme'" class="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
            <span class="text-zinc-700 dark:text-zinc-300 capitalize">{{ settings[key] || '—' }}</span>
          </div>
          <div v-else-if="key === 'accent_color'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <ColorPicker v-model="settings[key]" />
          </div>
          <div v-else-if="key === 'enhanced_animations'" class="form-group flex items-center gap-3 md:col-span-2">
            <Switch v-model="settings[key]" />
            <span class="text-zinc-700 dark:text-zinc-300">{{ formatLabel(key) }}</span>
          </div>
          <div v-else-if="key === 'current_theme'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input v-model="settings[key]" type="text" class="form-input" placeholder="e.g. sunset" />
          </div>
          <div v-else-if="key === 'zoom_level'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input v-model.number="settings[key]" type="number" class="form-input" placeholder="100" min="80" max="150" step="5" />
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Page zoom percentage (80–150). Leave empty for default.</p>
          </div>
        </template>
      </div>
    </section>

    <!-- Features -->
    <section v-if="hasSection('features') || getSectionKeys('featuresDisplayOnly').length > 0">
      <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <SparklesIcon class="w-5 h-5 text-primary-500" /> Features
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <template v-for="key in getSectionKeys('features')" :key="key">
          <div v-if="typeof settings[key] === 'boolean' || (['quiz_generator_enabled'].includes(key) && settings[key] == null)" class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
            <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ formatLabel(key) }}</span>
            <Switch v-model="settings[key]" :invert="key === 'disable_school_picture'" />
          </div>
          <div v-else class="form-group p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input v-model="settings[key]" type="text" class="form-input" :placeholder="`Enter ${formatLabel(key)}`" />
          </div>
        </template>
        <div v-for="key in getSectionKeys('featuresDisplayOnly')" :key="'disp-' + key" class="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
          <span class="text-zinc-500 dark:text-zinc-400 text-sm block">{{ formatLabel(key) }}</span>
          <p class="text-zinc-900 dark:text-white font-medium mt-1">{{ typeof settings[key] === 'boolean' ? (settings[key] ? 'Yes' : 'No') : (settings[key] || '—') }}</p>
        </div>
      </div>
    </section>

    <!-- AI & Analytics -->
    <section v-if="hasSection('ai')">
      <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <CpuChipIcon class="w-5 h-5 text-primary-500" /> AI & Analytics
      </h2>
      <div class="space-y-4">
        <template v-for="key in getSectionKeys('ai')" :key="key">
          <div v-if="typeof settings[key] === 'boolean'" class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
            <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ formatLabel(key) }}</span>
            <Switch v-model="settings[key]" />
          </div>
          <div v-else-if="key === 'ai_provider'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <select v-model="settings[key]" class="form-select">
              <option value="gemini">Gemini</option>
              <option value="cerebras">Cerebras</option>
            </select>
          </div>
          <div v-else-if="key === 'cerebras_api_key' && settings.ai_provider === 'cerebras'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input
              type="password"
              :name="key"
              autocomplete="new-password"
              v-model="settings[key]"
              class="form-input"
              :placeholder="`Enter ${formatLabel(key)}`"
            />
          </div>
          <div v-else-if="key !== 'cerebras_api_key'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input
              type="password"
              :name="key"
              autocomplete="new-password"
              v-model="settings[key]"
              class="form-input"
              :placeholder="`Enter ${formatLabel(key)}`"
            />
          </div>
        </template>
      </div>
    </section>

    <!-- Notifications -->
    <section v-if="hasSection('notifications')">
      <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <BellIcon class="w-5 h-5 text-primary-500" /> Notifications
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="key in getSectionKeys('notifications')" :key="key" class="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
          <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ formatLabel(key) }}</span>
          <Switch v-model="settings[key]" />
        </div>
      </div>
    </section>

    <!-- General -->
    <section v-if="hasSection('general')">
      <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <GlobeAltIcon class="w-5 h-5 text-primary-500" /> General
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <template v-for="key in getSectionKeys('general')" :key="key">
          <div class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <select v-model="settings[key]" class="form-select">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
        </template>
      </div>
    </section>

    <!-- Developer -->
    <section v-if="hasSection('developer')" class="border-t border-zinc-200 dark:border-zinc-700 pt-6">
      <button type="button" @click="showDevOptions = !showDevOptions" class="w-full flex items-center justify-between text-lg font-semibold text-zinc-900 dark:text-white mb-4 hover:text-primary-500 transition-colors duration-200 focus:outline-none">
        <span>Developer Options</span>
        <component :is="showDevOptions ? ChevronUpIcon : ChevronDownIcon" class="w-5 h-5" />
      </button>
      <div v-if="showDevOptions" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
        <div v-for="key in getSectionKeys('developer')" :key="key" class="flex items-center justify-between p-3 rounded-lg">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">{{ formatLabel(key) }}</span>
          <Switch v-model="settings[key]" />
        </div>
      </div>
    </section>

    <!-- Other Settings -->
    <section v-if="getOtherSettings.length > 0">
      <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <CogIcon class="w-5 h-5 text-primary-500" /> Other Settings
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <template v-for="key in getOtherSettings" :key="key">
          <div v-if="typeof settings[key] === 'boolean'" class="form-group flex items-center gap-3">
            <Switch v-model="settings[key]" />
            <span class="text-zinc-700 dark:text-zinc-300">{{ formatLabel(key) }}</span>
          </div>
          <div v-else-if="getFieldType(key, settings[key]) === 'color'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <ColorPicker v-model="settings[key]" />
          </div>
          <div v-else-if="getFieldType(key, settings[key]) === 'password'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input
              type="password"
              :name="key"
              autocomplete="new-password"
              v-model="settings[key]"
              class="form-input"
              :placeholder="`Enter ${formatLabel(key)}`"
            />
          </div>
          <div v-else-if="typeof settings[key] === 'number'" class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input
              type="number"
              v-model.number="settings[key]"
              class="form-input"
              :placeholder="`Enter ${formatLabel(key)}`"
            />
          </div>
          <div v-else class="form-group">
            <label class="form-label">{{ formatLabel(key) }}</label>
            <input
              type="text"
              v-model="settings[key]"
              class="form-input"
              :placeholder="`Enter ${formatLabel(key)}`"
            />
          </div>
        </template>
      </div>
    </section>

    <div class="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700 sticky bottom-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur p-4 -mx-8 -mb-8 rounded-b-2xl z-10">
      <p v-if="success" class="mr-4 text-green-500 font-medium self-center animate-fade-in">{{ success }}</p>
      <p v-if="error" class="mr-4 text-red-500 dark:text-red-400 font-medium self-center animate-fade-in">{{ error }}</p>
      <button
        type="button"
        @click="$emit('save')"
        :disabled="loading"
        class="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-6 rounded-lg transition-all duration-200 shadow-lg shadow-primary-500/30 flex items-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <LoadingSpinner v-if="loading" size="sm" class="text-white" />
        <span v-else>Save Changes</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import Switch from '~/components/ui/Switch.vue'
import ColorPicker from '~/components/ui/ColorPicker.vue'
import {
  CogIcon,
  SwatchIcon,
  SparklesIcon,
  CpuChipIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BellIcon,
  GlobeAltIcon,
} from '@heroicons/vue/24/outline'

const settings = defineModel<Record<string, any>>({ default: () => ({}) })

/** Keys we still sync but do not show on the BS+ settings UI (internal / noisy / large blobs). */
const BSPLUS_UI_HIDDEN_KEYS_RAW = [
  'PrivacyStatementLastUpdated',
  'SelectedTheme',
  'Shortcuts',
  'Subjectfilters',
  'Plugin.NotificationCollector.Storage.LastNotificationCount',
  'Plugin.Profile-Picture.Settings',
  'Plugin.Timetable.Settings',
  'Plugin.TimetableEdit.Storage.TimetableOverrides',
  'Plugin.NotificationCollector.Storage.ConsecutiveErrors',
  'Plugin.NotificationCollector.Storage.LastCheckedTime',
  'Plugin.Assessments-Average.Settings',
  'Plugin.Global-Search.Settings',
  'Customshortcuts',
  'Defaultmenuorder',
  'Bksliderinput',
] as const

/** Extension storage keys vary by casing; match case-insensitively. */
const BSPLUS_UI_HIDDEN_KEYS_LOWER = new Set(
  BSPLUS_UI_HIDDEN_KEYS_RAW.map((k) => k.trim().toLowerCase()),
)

const props = withDefaults(
  defineProps<{
    loading?: boolean
    error?: string
    success?: string
    /** Only for BetterSEQTA+ tab: hide internal keys from the form; values stay in the model for save. */
    hideBsPlusInternalKeys?: boolean
  }>(),
  { hideBsPlusInternalKeys: false },
)

defineEmits<{ save: [] }>()

const showDevOptions = ref(false)

const settingsSections = {
  appearance: ['theme', 'accent_color', 'enhanced_animations', 'current_theme', 'zoom_level'],
  features: ['weather_enabled', 'reminders_enabled', 'disable_school_picture', 'global_search_enabled', 'separate_rss_feed', 'quiz_generator_enabled'],
  featuresDisplayOnly: ['weather_city', 'weather_country', 'force_use_location'],
  ai: ['ai_integrations_enabled', 'ai_provider', 'grade_analyser_enabled', 'lesson_summary_analyser_enabled', 'gemini_api_key', 'cerebras_api_key'],
  notifications: ['auto_dismiss_message_notifications'],
  general: ['language'],
  developer: ['dev_sensitive_info_hider', 'dev_force_offline_mode'],
}

const hasSection = (section: string) => {
  return getSectionKeys(section).length > 0
}

const isBsPlusUiHidden = (key: string) =>
  props.hideBsPlusInternalKeys &&
  BSPLUS_UI_HIDDEN_KEYS_LOWER.has(String(key).trim().toLowerCase())

const getSectionKeys = (section: string) => {
  const knownKeys = settingsSections[section as keyof typeof settingsSections] || []
  return knownKeys.filter((key) => key in settings.value && !isBsPlusUiHidden(key))
}

const formatLabel = (key: string) => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

const getFieldType = (key: string, value: any): 'switch' | 'color' | 'password' | 'select' | 'number' | 'text' => {
  if (typeof value === 'boolean') return 'switch'
  if (typeof value === 'number' || (value === null && key === 'zoom_level')) return 'number'
  if (value === null && key === 'quiz_generator_enabled') return 'switch'
  if (key.toLowerCase().includes('color')) return 'color'
  if (key.toLowerCase().match(/(key|password|secret|token)/)) return 'password'
  if (['theme', 'ai_provider', 'language'].includes(key)) return 'select'
  return 'text'
}

const getOtherSettings = computed(() => {
  const allKnownKeys = Object.values(settingsSections).flat()
  return Object.keys(settings.value).filter(
    (key) => !allKnownKeys.includes(key) && !isBsPlusUiHidden(key),
  )
})
</script>

<style scoped>
.form-group {
  @apply flex flex-col gap-1.5;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  @apply text-sm font-medium text-zinc-700 dark:text-zinc-300;
  display: block;
  line-height: 1.5;
  margin-bottom: 0.375rem;
}

.form-input {
  @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200;
}

.form-select {
  @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200;
  min-height: 2.5rem;
  height: 2.5rem;
  line-height: 1.5;
  display: block;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.75rem;
  padding-right: 2.5rem;
  vertical-align: middle;
  box-sizing: border-box;
}
</style>
