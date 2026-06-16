export type SettingSubFieldType =
  | 'boolean'
  | 'string'
  | 'number'
  | 'enum'
  | 'color'
  | 'hotkey'
  | 'month'

export type SettingSubFieldDef = {
  key: string
  label: string
  description?: string
  type: SettingSubFieldType
  enumOptions?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  invert?: boolean
}

export type SettingFieldType =
  | 'boolean'
  | 'string'
  | 'password'
  | 'color'
  | 'colorOrGradient'
  | 'number'
  | 'enum'
  | 'stringList'
  | 'shortcutList'
  | 'feedList'
  | 'json'
  | 'object'
  | 'menuItems'
  | 'menuLayout'
  | 'sidebarLayout'
  | 'toggleList'
  | 'keyValueBooleans'
  | 'sidebarFolders'
  | 'messageFolders'
  | 'month'
  | 'readOnly'

export type SettingFieldDef = {
  key: string
  label: string
  description?: string
  type: SettingFieldType
  defaultValue: unknown
  section: string
  hidden?: boolean
  advanced?: boolean
  requiresDev?: boolean
  visibleWhen?: (draft: Record<string, unknown>) => boolean
  enumOptions?: { value: string; label: string }[]
  subFields?: SettingSubFieldDef[]
  min?: number
  max?: number
  step?: number
  invert?: boolean
  /** Use slider UI for numeric fields when min/max are set. */
  useSlider?: boolean
}

export type SettingSectionDef = {
  id: string
  label: string
  description?: string
  icon?: string
  advanced?: boolean
  requiresDev?: boolean
  /** Advanced sections only: start expanded instead of collapsed. */
  defaultExpanded?: boolean
}

export type SettingsSchema = {
  sections: SettingSectionDef[]
  fields: SettingFieldDef[]
  hiddenKeys?: string[]
  hiddenKeyPrefixes?: string[]
}
