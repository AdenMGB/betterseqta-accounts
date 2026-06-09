import type { SettingSubFieldDef } from './types'

export const PLUGIN_SUB_FIELDS: Record<string, SettingSubFieldDef[]> = {
  'plugin.animated-background.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'speed', label: 'Animation speed', type: 'number', min: 0.1, max: 2.0, step: 0.05 },
  ],
  'plugin.assessments-average.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'lettergrade', label: 'Show letter grades', type: 'boolean' },
  ],
  'plugin.notificationCollector.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
  ],
  'plugin.timetable.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
  ],
  'plugin.timetableEdit.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
  ],
  'plugin.global-search.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'searchHotkey', label: 'Search hotkey', type: 'hotkey' },
    { key: 'showRecentFirst', label: 'Show recent first', type: 'boolean' },
    { key: 'transparencyEffects', label: 'Transparency effects', type: 'boolean' },
    { key: 'runIndexingOnLoad', label: 'Run indexing on load', type: 'boolean' },
    { key: 'passiveIndexing', label: 'Passive indexing', type: 'boolean' },
  ],
  'plugin.profile-picture.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'useCloudPfp', label: 'Use cloud profile picture', type: 'boolean' },
  ],
  'plugin.messageFolders.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'showTagsInAllMessages', label: 'Show tags in All Messages', type: 'boolean' },
    { key: 'hideFolderedMessagesInAll', label: 'Hide foldered messages in All', type: 'boolean' },
  ],
  'plugin.enhanced-navigation.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'autoScrollOnClick', label: 'Auto-scroll on click', type: 'boolean' },
  ],
  'plugin.background-music.settings': [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'volume', label: 'Volume', type: 'number', min: 0, max: 1, step: 0.05 },
    { key: 'pauseOnHidden', label: 'Pause when tab hidden', type: 'boolean' },
  ],
  'plugin.grade-analytics.settings': [
    { key: 'cacheTtlHours', label: 'Cache TTL (hours)', type: 'number', min: 1, max: 168, step: 1 },
  ],
}

export const FONT_OPTIONS = [
  { value: 'rubik', label: 'Rubik' },
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'nunito', label: 'Nunito' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'open-sans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
  { value: 'source-sans-3', label: 'Source Sans 3' },
  { value: 'raleway', label: 'Raleway' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'plus-jakarta-sans', label: 'Plus Jakarta Sans' },
  { value: 'outfit', label: 'Outfit' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'work-sans', label: 'Work Sans' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'figtree', label: 'Figtree' },
  { value: 'lexend', label: 'Lexend' },
  { value: 'ubuntu', label: 'Ubuntu' },
  { value: 'karla', label: 'Karla' },
  { value: 'quicksand', label: 'Quicksand' },
  { value: 'ibm-plex-sans', label: 'IBM Plex Sans' },
  { value: 'space-grotesk', label: 'Space Grotesk' },
  { value: 'mulish', label: 'Mulish' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'oswald', label: 'Oswald' },
  { value: 'merriweather', label: 'Merriweather' },
  { value: 'playfair-display', label: 'Playfair Display' },
  { value: 'lora', label: 'Lora' },
  { value: 'crimson-pro', label: 'Crimson Pro' },
  { value: 'libre-baskerville', label: 'Libre Baskerville' },
  { value: 'system', label: 'System' },
]

export const DEFAULT_BUILTIN_SHORTCUTS = [
  { name: 'Outlook', enabled: true },
  { name: 'Office', enabled: true },
  { name: 'Google', enabled: true },
]
