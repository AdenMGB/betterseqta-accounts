<template>
  <div class="flex min-h-0 flex-col">
    <div class="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain pb-1 admin-table-scroll">
    <template v-for="section in visibleSections" :key="section.id">
        <section v-if="sectionFields(section.id).length > 0">
          <div class="mb-4">
            <button
              v-if="section.advanced"
              type="button"
              class="flex w-full items-center justify-between text-left text-sm font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-zinc-400"
              @click="toggleSection(section.id)"
            >
              <span>{{ section.label }}</span>
              <component :is="expandedSections[section.id] ? ChevronUpIcon : ChevronDownIcon" class="h-4 w-4 shrink-0" />
            </button>
            <h3 v-else class="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {{ section.label }}
            </h3>
            <p
              v-if="section.description && (section.advanced ? expandedSections[section.id] : true)"
              class="mt-1 text-sm text-zinc-500 dark:text-zinc-400"
            >
              {{ section.description }}
            </p>
          </div>

          <div
            v-if="!section.advanced || expandedSections[section.id]"
            class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20"
          >
            <div class="divide-y divide-zinc-200/70 dark:divide-zinc-700/70">
              <template v-for="field in sectionFields(section.id)" :key="field.key">
                <div
                  v-if="field.type === 'boolean'"
                  class="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div class="min-w-0">
                    <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ field.label }}</span>
                    <p v-if="field.description" class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{{ field.description }}</p>
                  </div>
                  <Switch
                    class="shrink-0"
                    :model-value="!!draft[field.key]"
                    :invert="field.invert"
                    @update:model-value="updateField(field.key, $event)"
                  />
                </div>

                <div v-else-if="field.type === 'readOnly'" class="px-4 py-3.5 sm:px-5">
                  <span class="block text-sm text-zinc-500 dark:text-zinc-400">{{ field.label }}</span>
                  <p class="mt-1 font-medium text-zinc-900 dark:text-white">
                    {{ formatReadOnly(draft[field.key]) }}
                  </p>
                  <p v-if="field.description" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ field.description }}</p>
                </div>

                <div v-else class="px-4 py-4 sm:px-5">
                  <div class="field-stack">
                    <div>
                      <label class="form-label">{{ field.label }}</label>
                      <p v-if="field.description" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ field.description }}</p>
                    </div>

                  <select
                    v-if="field.type === 'enum'"
                    :value="String(draft[field.key] ?? '')"
                    class="form-select"
                    @change="updateField(field.key, ($event.target as HTMLSelectElement).value)"
                  >
                    <option
                      v-for="opt in field.enumOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>

                  <ColorPicker
                    v-else-if="field.type === 'color'"
                    :model-value="String(draft[field.key] ?? '')"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingColorOrGradientEditor
                    v-else-if="field.type === 'colorOrGradient'"
                    :model-value="String(draft[field.key] ?? '')"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <div v-else-if="field.type === 'number' && (field.useSlider || (field.min != null && field.max != null))" class="pt-1">
                    <div class="flex items-center gap-3">
                      <input
                        type="range"
                        :value="Number(draft[field.key] ?? field.min ?? 0)"
                        :min="field.min"
                        :max="field.max"
                        :step="field.step ?? 0.01"
                        class="flex-1 accent-primary-500"
                        @input="onNumberInput(field, $event)"
                      />
                      <span class="w-12 text-right font-mono text-sm text-zinc-600 dark:text-zinc-400">
                        {{ draft[field.key] ?? field.min ?? '—' }}
                      </span>
                    </div>
                  </div>

                  <input
                    v-else-if="field.type === 'month'"
                    type="month"
                    :value="String(draft[field.key] ?? '')"
                    class="form-input"
                    @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
                  />

                  <input
                    v-else-if="field.type === 'number'"
                    type="number"
                    :value="draft[field.key] == null ? '' : draft[field.key]"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step ?? 'any'"
                    class="form-input"
                    @input="onNumberInput(field, $event)"
                  />

                  <input
                    v-else-if="field.type === 'password'"
                    type="password"
                    :name="field.key"
                    autocomplete="new-password"
                    :value="String(draft[field.key] ?? '')"
                    class="form-input"
                    :placeholder="`Enter ${field.label.toLowerCase()}`"
                    @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
                  />

                  <input
                    v-else-if="field.type === 'string'"
                    type="text"
                    :value="String(draft[field.key] ?? '')"
                    class="form-input"
                    @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
                  />

                  <SettingListEditor
                    v-else-if="field.type === 'stringList'"
                    :model-value="(draft[field.key] as string[] | null)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingShortcutEditor
                    v-else-if="field.type === 'shortcutList'"
                    :model-value="(draft[field.key] as any)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingFeedEditor
                    v-else-if="field.type === 'feedList'"
                    :model-value="(draft[field.key] as any)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingMenuLayoutEditor
                    v-else-if="field.type === 'menuLayout'"
                    :menu-items="(draft.menuitems as any)"
                    :menu-order="(draft.menuorder as string[] | null)"
                    @update:menu-items="updateField('menuitems', $event)"
                    @update:menu-order="updateField('menuorder', $event)"
                  />

                  <SettingDesqtaSidebarLayoutEditor
                    v-else-if="field.type === 'sidebarLayout'"
                    :menu-order="(draft.menu_order as string[] | null)"
                    :disabled-pages="(draft.disabled_sidebar_pages as string[] | null)"
                    :folders="(draft.sidebar_folders as any)"
                    @update:menu-order="updateField('menu_order', $event)"
                    @update:disabled-pages="updateField('disabled_sidebar_pages', $event)"
                  />

                  <SettingMenuItemsEditor
                    v-else-if="field.type === 'menuItems'"
                    :model-value="(draft[field.key] as any)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingObjectEditor
                    v-else-if="field.type === 'object' && field.subFields?.length"
                    :model-value="(draft[field.key] as Record<string, unknown>)"
                    :sub-fields="field.subFields"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingToggleListEditor
                    v-else-if="field.type === 'toggleList'"
                    :model-value="(draft[field.key] as any)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingKeyValueBooleansEditor
                    v-else-if="field.type === 'keyValueBooleans'"
                    :model-value="(draft[field.key] as Record<string, boolean>)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingSidebarFoldersEditor
                    v-else-if="field.type === 'sidebarFolders'"
                    :model-value="(draft[field.key] as any)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingMessageFoldersEditor
                    v-else-if="field.type === 'messageFolders'"
                    :model-value="(draft[field.key] as any)"
                    @update:model-value="updateField(field.key, $event)"
                  />

                  <SettingJsonEditor
                    v-else-if="field.type === 'json'"
                    :model-value="draft[field.key]"
                    @update:model-value="updateField(field.key, $event)"
                  />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </section>
      </template>

      <section
        v-if="unrecognizedKeys.length > 0 && isUnrecognizedEnabled(appId)"
        class="border-t border-zinc-200/80 pt-6 dark:border-zinc-700/60"
      >
        <button
          type="button"
          class="mb-3 flex w-full items-center justify-between text-left text-sm font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-primary-500 focus:outline-none dark:text-zinc-400"
          @click="showUnrecognized = !showUnrecognized"
        >
          <span>Unrecognized settings ({{ unrecognizedKeys.length }})</span>
          <component :is="showUnrecognized ? ChevronUpIcon : ChevronDownIcon" class="h-4 w-4 shrink-0" />
        </button>
        <p v-if="!showUnrecognized" class="text-sm text-zinc-500 dark:text-zinc-400">
          Keys from your cloud backup not in the schema. Edit with care.
        </p>
        <div
          v-if="showUnrecognized"
          class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20"
        >
          <div class="divide-y divide-zinc-200/70 dark:divide-zinc-700/70">
            <template v-for="key in unrecognizedKeys" :key="key">
              <div
                v-if="typeof unrecognizedDraft[key] === 'boolean'"
                class="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
              >
                <span class="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300">{{ key }}</span>
                <Switch
                  class="shrink-0"
                  :model-value="!!unrecognizedDraft[key]"
                  @update:model-value="updateUnrecognized(key, $event)"
                />
              </div>
              <div v-else-if="isJsonLike(unrecognizedDraft[key])" class="px-4 py-4 sm:px-5">
                <SettingJsonEditor
                  :label="key"
                  :model-value="unrecognizedDraft[key]"
                  @update:model-value="updateUnrecognized(key, $event)"
                />
              </div>
              <div v-else class="px-4 py-4 sm:px-5">
                <div class="field-stack">
                  <label class="form-label font-mono text-sm">{{ key }}</label>
                  <input
                  type="text"
                  :value="String(unrecognizedDraft[key] ?? '')"
                  class="form-input"
                  @input="updateUnrecognized(key, ($event.target as HTMLInputElement).value)"
                />
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>
    </div>

    <footer class="mt-6 flex shrink-0 items-center gap-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-700/60">
      <p v-if="hasChanges" class="text-sm text-amber-600 dark:text-amber-400">Unsaved changes</p>
      <p v-if="success" class="text-sm font-medium text-green-500">{{ success }}</p>
      <p v-if="error" class="text-sm font-medium text-red-500 dark:text-red-400">{{ error }}</p>
      <div class="ml-auto flex shrink-0 items-center gap-3">
      <button
        type="button"
        :disabled="loading || !hasChanges"
        class="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
        @click="showDiscardConfirm = true"
      >
        Discard changes
      </button>
      <button
        type="button"
        :disabled="loading || !hasChanges"
        class="flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('save')"
      >
        <LoadingSpinner v-if="loading" size="sm" class="text-white" />
        <span v-else>Save Changes</span>
      </button>
      </div>
    </footer>

    <ConfirmDialog
      :open="showDiscardConfirm"
      title="Discard all changes?"
      message="This will revert every setting on this tab back to the last saved cloud values. Your edits will be lost."
      confirm-label="Discard"
      destructive
      @cancel="showDiscardConfirm = false"
      @confirm="confirmDiscard"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import type { SettingFieldDef, SettingsSchema } from '~/utils/settings/types'
import type { SettingsAppId } from '~/utils/settings/settingsPageConfig'
import { isFieldEnabled, isSectionEnabled, isUnrecognizedEnabled } from '~/utils/settings/settingsPageConfig'
import { clonePlain } from '~/utils/settings/sparseSettings'
import Switch from '~/components/ui/Switch.vue'
import ColorPicker from '~/components/ui/ColorPicker.vue'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import SettingListEditor from '~/components/settings/SettingListEditor.vue'
import SettingShortcutEditor from '~/components/settings/SettingShortcutEditor.vue'
import SettingFeedEditor from '~/components/settings/SettingFeedEditor.vue'
import SettingMenuItemsEditor from '~/components/settings/SettingMenuItemsEditor.vue'
import SettingMenuLayoutEditor from '~/components/settings/SettingMenuLayoutEditor.vue'
import SettingDesqtaSidebarLayoutEditor from '~/components/settings/SettingDesqtaSidebarLayoutEditor.vue'
import SettingJsonEditor from '~/components/settings/SettingJsonEditor.vue'
import SettingObjectEditor from '~/components/settings/SettingObjectEditor.vue'
import SettingToggleListEditor from '~/components/settings/SettingToggleListEditor.vue'
import SettingKeyValueBooleansEditor from '~/components/settings/SettingKeyValueBooleansEditor.vue'
import SettingSidebarFoldersEditor from '~/components/settings/SettingSidebarFoldersEditor.vue'
import SettingMessageFoldersEditor from '~/components/settings/SettingMessageFoldersEditor.vue'
import SettingColorOrGradientEditor from '~/components/settings/SettingColorOrGradientEditor.vue'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'

const props = defineProps<{
  appId: SettingsAppId
  schema: SettingsSchema
  draft: Record<string, unknown>
  unrecognizedDraft: Record<string, unknown>
  unrecognizedKeys: string[]
  hasChanges: boolean
  loading?: boolean
  error?: string
  success?: string
}>()

const emit = defineEmits<{
  save: []
  discard: []
  'update:draft': [draft: Record<string, unknown>]
  'update:unrecognizedDraft': [draft: Record<string, unknown>]
}>()

const showDiscardConfirm = ref(false)

const showUnrecognized = ref(false)
const expandedSections = reactive<Record<string, boolean>>({})

for (const section of props.schema.sections) {
  if (section.advanced) {
    expandedSections[section.id] = section.defaultExpanded === true
  }
}

const devModeEnabled = computed(() => props.draft.devMode === true)

const visibleSections = computed(() =>
  props.schema.sections.filter((s) => {
    if (!isSectionEnabled(props.appId, s.id)) return false
    if (s.requiresDev && !devModeEnabled.value) return false
    return sectionFields(s.id).length > 0
  }),
)

function sectionFields(sectionId: string): SettingFieldDef[] {
  return props.schema.fields.filter((field) => {
    if (field.section !== sectionId) return false
    if (field.hidden) return false
    if (!isFieldEnabled(props.appId, field.key, field.section)) return false
    if (field.requiresDev && !devModeEnabled.value) return false
    if (field.visibleWhen && !field.visibleWhen(props.draft)) return false
    return true
  })
}

function toggleSection(id: string) {
  expandedSections[id] = !expandedSections[id]
}

function updateField(key: string, value: unknown) {
  emit('update:draft', clonePlain({ ...props.draft, [key]: value }))
}

function updateUnrecognized(key: string, value: unknown) {
  emit('update:unrecognizedDraft', clonePlain({ ...props.unrecognizedDraft, [key]: value }))
}

function confirmDiscard() {
  showDiscardConfirm.value = false
  emit('discard')
}

function onNumberInput(field: SettingFieldDef, e: Event) {
  const raw = (e.target as HTMLInputElement).value
  if (raw === '') {
    updateField(field.key, null)
    return
  }
  const num = Number(raw)
  updateField(field.key, Number.isNaN(num) ? null : num)
}

function formatReadOnly(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value == null) return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function isJsonLike(value: unknown): boolean {
  return value !== null && typeof value === 'object'
}
</script>

<style scoped>
.field-stack {
  @apply flex flex-col gap-2.5;
}
.form-label {
  @apply text-sm font-medium text-zinc-700 dark:text-zinc-300;
}
.form-input {
  @apply w-full rounded-lg border border-zinc-300 bg-white/50 px-3 py-2 text-zinc-900 transition-all duration-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-white dark:placeholder-zinc-400;
}
.form-select {
  @apply w-full rounded-lg border border-zinc-300 bg-white/50 px-3 py-2 text-zinc-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-white;
  min-height: 2.5rem;
}
</style>
