import { AUTH_FETCH } from '~/composables/useAuthFetch'

export type CustomThemeStatus = 'pending' | 'approved' | 'rejected'
export type CustomThemeType = 'betterseqta' | 'desqta'

export type CustomTheme = {
  id: string
  name: string
  slug: string
  version?: string
  description?: string | null
  theme_type: CustomThemeType
  status: CustomThemeStatus
  download_count?: number
  created_at: number
  updated_at: number
  published_at?: number | null
  reviewed_at?: number | null
  coverImage?: string | null
  preview?: { thumbnail?: string | null }
  preview_thumbnail_url?: string | null
  submission_notes?: string | null
  rejection_reason?: string | null
}

export type CustomThemeFile = {
  id: string
  file_path: string
  file_type: string
  file_size: number
}

export type CustomThemesPagination = { page: number; limit: number; total: number; total_pages: number }

type SubmitResult = { theme: CustomTheme; validation?: { warnings: string[] } }
type ApiErrorData = { error?: string | { message?: string; details?: { errors?: string[]; warnings?: string[] } } }

const BASE = '/api/custom-themes/mine'

export function formatThemeDate(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null) return '—'
  return new Date(unixSeconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function themeErrorDetails(err: unknown) {
  const error = (err as { data?: ApiErrorData })?.data?.error
  return typeof error === 'object' ? error.details ?? {} : {}
}

export function parseCustomThemesError(err: unknown): string {
  const e = err as { data?: ApiErrorData; message?: string }
  const error = e?.data?.error
  if (typeof error === 'string') return error
  return error?.details?.errors?.join('\n') || error?.message || e?.message || 'Something went wrong.'
}

async function request<T>(path: string, options: Record<string, unknown> = {}): Promise<T> {
  const res = await $fetch<{ data: T }>(`${BASE}${path}`, { ...AUTH_FETCH, ...options })
  return res.data
}

export function useCustomThemes() {
  return {
    listMine: (query: { page?: number; limit?: number; status?: CustomThemeStatus; type?: CustomThemeType }) =>
      request<{ themes: CustomTheme[]; pagination: CustomThemesPagination }>('', { query }),
    getMine: (id: string) => request<{ theme: CustomTheme; files: CustomThemeFile[] }>(`/${id}`),
    submit: (body: FormData) => request<SubmitResult>('', { method: 'POST', body }),
    updateMetadata: (id: string, body: Partial<Pick<CustomTheme, 'name' | 'description' | 'submission_notes'>>) =>
      request<{ theme: CustomTheme }>(`/${id}`, { method: 'PUT', body }),
    replaceFiles: (id: string, body: FormData) => request<SubmitResult>(`/${id}/files`, { method: 'POST', body }),
    remove: (id: string) => request<unknown>(`/${id}`, { method: 'DELETE' }),
  }
}
