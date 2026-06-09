/**
 * Keys the accounts settings UI may expose — derived from UI accessibility maps in:
 * - exampleSYNCJSONSchema/DesQTA.md §13
 * - exampleSYNCJSONSchema/BQ+.md UI accessibility
 *
 * Excludes: read-only keys, automatic/popup-only flags, internal preview snapshots,
 * device-local metadata, and notification poll counters.
 */

export const DESQTA_ACCOUNTS_EDITABLE_KEYS = [
  // Cloud & personal (/settings)
  'sync_cloud_pfp',
  'language',
  // Homepage
  'weather_enabled',
  'force_use_location',
  'weather_city',
  'weather_country',
  'dashboard_today_schedule_fit_width',
  // Shortcuts & feeds
  'shortcuts',
  'separate_rss_feed',
  'feeds',
  // Appearance
  'accent_color',
  'theme',
  'custom_background_enabled',
  'custom_background_fit',
  'custom_background_opacity',
  'custom_background_dim',
  'auto_collapse_sidebar',
  'auto_expand_sidebar_hover',
  'global_search_enabled',
  'minimize_to_tray',
  'disable_school_picture',
  'enhanced_animations',
  'biometric_enabled',
  'zoom_level',
  // Notifications
  'reminders_enabled',
  'auto_dismiss_message_notifications',
  // AI
  'ai_integrations_enabled',
  'lesson_summary_analyser_enabled',
  'quiz_generator_enabled',
  'ai_provider',
  'gemini_api_key',
  'cerebras_api_key',
  // Sidebar collapse only — layout/folders/favourites managed in DesQTA app
  // 'menu_order', 'sidebar_folders', 'sidebar_favorites', 'disabled_sidebar_pages',
  // Cloud EULA & telemetry — managed in DesQTA app
  // 'accepted_cloud_eula', 'send_anonymous_usage_statistics',
] as const

export const BSPLUS_ACCOUNTS_EDITABLE_KEYS = [
  // Master
  'onoff',
  'autoCloudSettingsSync',
  // Appearance & theme
  'DarkMode',
  'selectedTheme',
  'selectedColor',
  'selectedFont',
  'transparencyEffects',
  'animations',
  'iconOnlySidebar',
  'adaptiveThemeColour',
  'adaptiveThemeGradient',
  'adaptiveThemeColourTransition',
  // Navigation
  'defaultPage',
  'timeFormat',
  // Sidebar layout — managed in extension on SEQTA tab
  // 'menuitems', 'menuorder',
  // Shortcuts — managed in extension popup
  // 'shortcuts', 'customshortcuts',
  // Subjects & news — hidden on accounts UI (managed in extension on SEQTA pages)
  // 'subjectfilters',
  // 'newsSource',
  // Settings-tab plugin prefs
  'themeOfTheMonthDisabled',
  'plugin.animated-background.settings',
  'plugin.assessments-average.settings',
  'plugin.notificationCollector.settings',
  'plugin.timetable.settings',
  'plugin.timetableEdit.settings',
  'plugin.global-search.settings',
  'plugin.profile-picture.settings',
  'plugin.messageFolders.settings',
  'plugin.enhanced-navigation.settings',
  'plugin.background-music.settings',
  'plugin.grade-analytics.settings',
  // Plugin runtime storage — managed in extension on SEQTA pages (synced, no accounts UI)
  // 'plugin.messageFolders.storage.folders',
  // 'plugin.messageFolders.storage.messageAssignments',
  // 'plugin.timetableEdit.storage.timetableOverrides',
  // 'plugin.timetableEdit.storage.timetableOverridesBySubject',
  // 'plugin.assessments-average.storage.weightingOverrides',
] as const

export type DesqtaEditableKey = (typeof DESQTA_ACCOUNTS_EDITABLE_KEYS)[number]
export type BsplusEditableKey = (typeof BSPLUS_ACCOUNTS_EDITABLE_KEYS)[number]

export function isAccountsEditableKey(appId: 'desqta' | 'bsplus', key: string): boolean {
  if (appId === 'desqta') {
    return (DESQTA_ACCOUNTS_EDITABLE_KEYS as readonly string[]).includes(key)
  }
  return (BSPLUS_ACCOUNTS_EDITABLE_KEYS as readonly string[]).includes(key)
}
