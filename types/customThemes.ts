export type CustomThemeStatus = 'pending' | 'approved' | 'rejected'
export type CustomThemeType = 'betterseqta' | 'desqta'

export interface ApiEnvelopeMeta {
  timestamp: number
  version: string
}

export interface ApiErrorBody {
  code?: string
  message?: string
  details?: Record<string, unknown>
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T | null
  error: ApiErrorBody | null
  meta: ApiEnvelopeMeta
}

export interface CustomThemePreview {
  thumbnail?: string | null
  screenshots?: string[]
}

export interface CustomThemeOwner {
  id: string
  name: string
  slug: string
  version?: string
  description?: string | null
  author?: string
  license?: string
  category?: string
  tags?: string[]
  theme_type: CustomThemeType | string
  download_count?: number
  preview?: CustomThemePreview
  compatibility?: { min?: string | null; max?: string | null }
  created_at: number
  updated_at: number
  published_at?: number | null
  coverImage?: string | null
  marqueeImage?: string | null
  theme_json_url?: string | null
  preview_thumbnail_url?: string | null
  zip_download_url?: string | null
  file_size?: number | null
  checksum?: string | null
  status: CustomThemeStatus
  submission_notes?: string | null
  rejection_reason?: string | null
  reviewed_at?: number | null
}

export interface CustomThemeFile {
  id: string
  file_path: string
  file_type: string
  file_size: number
  mime_type?: string | null
  created_at: number
}

export interface CustomThemesPagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface CustomThemesListData {
  themes: CustomThemeOwner[]
  pagination: CustomThemesPagination
}

export interface CustomThemeDetailData {
  theme: CustomThemeOwner
  files: CustomThemeFile[]
}

export interface CustomThemeSubmitData {
  theme: CustomThemeOwner
  validation?: {
    valid: boolean
    warnings: string[]
    errors: string[]
  }
}

export interface CustomThemeMetadataPatch {
  name?: string
  description?: string
  submission_notes?: string
}

export interface CustomThemesListParams {
  page?: number
  limit?: number
  status?: CustomThemeStatus
  type?: CustomThemeType
}
