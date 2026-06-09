/**
 * Admin-level settings page configuration.
 * Toggle fields/sections on or off without changing the sync schema.
 *
 * By default only keys listed in accountsEditableKeys.ts (from the schema docs) are shown.
 * Admins can further restrict via disabledFields / disabledSections below.
 */

import {
  BSPLUS_ACCOUNTS_EDITABLE_KEYS,
  DESQTA_ACCOUNTS_EDITABLE_KEYS,
  isAccountsEditableKey,
} from './accountsEditableKeys'

export type SettingsAppId = 'desqta' | 'bsplus'

export type SettingsPageAppConfig = {
  /** Field keys hidden from the settings UI. */
  disabledFields?: string[]
  /** Section ids hidden from the settings UI. */
  disabledSections?: string[]
  /** When set, only these field keys are shown. Defaults to accountsEditableKeys from schema docs. */
  enabledFieldsOnly?: string[]
  /** Hide the "Unrecognized settings" fallback section. */
  hideUnrecognized?: boolean
}

export type SettingsPageConfig = Record<SettingsAppId, SettingsPageAppConfig>

export const settingsPageConfig: SettingsPageConfig = {
  desqta: {
    enabledFieldsOnly: [...DESQTA_ACCOUNTS_EDITABLE_KEYS],
    disabledFields: [
      'accepted_cloud_eula',
      'send_anonymous_usage_statistics',
      'menu_order',
      'sidebar_folders',
      'sidebar_favorites',
      'disabled_sidebar_pages',
    ],
    disabledSections: ['developer', 'onboarding'],
    hideUnrecognized: true,
  },
  bsplus: {
    enabledFieldsOnly: [...BSPLUS_ACCOUNTS_EDITABLE_KEYS],
    disabledFields: ['shortcuts', 'customshortcuts', 'menuitems', 'menuorder'],
    disabledSections: ['developer', 'subjects', 'pluginStorage', 'shortcuts'],
    hideUnrecognized: true,
  },
}

export function isFieldEnabled(appId: SettingsAppId, fieldKey: string, sectionId: string): boolean {
  const cfg = settingsPageConfig[appId]
  if (cfg.disabledSections?.includes(sectionId)) return false

  const whitelist = cfg.enabledFieldsOnly?.length
    ? cfg.enabledFieldsOnly
    : null

  if (whitelist) {
    if (!whitelist.includes(fieldKey)) return false
  } else if (!isAccountsEditableKey(appId, fieldKey)) {
    return false
  }

  if (cfg.disabledFields?.includes(fieldKey)) return false
  return true
}

export function isSectionEnabled(appId: SettingsAppId, sectionId: string): boolean {
  return !settingsPageConfig[appId].disabledSections?.includes(sectionId)
}

export function isUnrecognizedEnabled(appId: SettingsAppId): boolean {
  return !settingsPageConfig[appId].hideUnrecognized
}
