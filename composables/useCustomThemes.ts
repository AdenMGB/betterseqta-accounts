import { AUTH_FETCH } from '~/composables/useAuthFetch'
import type {
  ApiEnvelope,
  CustomThemeDetailData,
  CustomThemeMetadataPatch,
  CustomThemesListData,
  CustomThemesListParams,
  CustomThemeSubmitData,
} from '~/types/customThemes'

const BASE = '/api/custom-themes/mine'

export function formatThemeDate(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null) return '—'
  try {
    return new Date(unixSeconds * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return String(unixSeconds)
  }
}

export function parseCustomThemesError(err: unknown): string {
  const e = err as {
    status?: number
    statusCode?: number
    data?: ApiEnvelope<unknown> | { statusMessage?: string; message?: string; error?: string }
    statusMessage?: string
    message?: string
  }

  const status = e.status ?? e.statusCode
  const envelope = e.data as ApiEnvelope<unknown> | undefined

  if (envelope?.error) {
    const { code, message, details } = envelope.error
    if (code === 'INVALID_THEME_STRUCTURE' && details?.errors) {
      const errors = details.errors as string[]
      if (Array.isArray(errors) && errors.length) {
        return errors.join('\n')
      }
    }
    if (message) return message
    if (code) return code
  }

  const statusMessage =
    (e.data as { statusMessage?: string })?.statusMessage ??
    e.statusMessage ??
    (e.data as { message?: string })?.message ??
    (e.data as { error?: string })?.error

  if (status === 409) {
    return statusMessage || 'This theme cannot be edited. Delete and re-submit instead.'
  }
  if (status === 429) {
    return statusMessage || 'Upload limit reached. Try again later or remove pending submissions.'
  }
  if (status === 422) {
    return statusMessage || 'Theme validation failed.'
  }
  if (status === 403) {
    return statusMessage || 'You do not have permission to perform this action.'
  }
  if (status === 404) {
    return statusMessage || 'Theme not found.'
  }
  if (status === 401) {
    return 'Please sign in again.'
  }

  return statusMessage || e.message || 'Something went wrong.'
}

function buildListQuery(params: CustomThemesListParams = {}): string {
  const q = new URLSearchParams()
  if (params.page != null) q.set('page', String(params.page))
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.status) q.set('status', params.status)
  if (params.type) q.set('type', params.type)
  const qs = q.toString()
  return qs ? `?${qs}` : ''
}

async function unwrap<T>(promise: Promise<ApiEnvelope<T>>): Promise<T> {
  const res = await promise
  if (!res.success || res.data == null) {
    const message = res.error?.message || 'Request failed'
    const err = new Error(message) as Error & { data?: ApiEnvelope<unknown>; statusCode?: number }
    err.data = res
    err.statusCode = 400
    throw err
  }
  return res.data
}

export function useCustomThemes() {
  const listMine = (params: CustomThemesListParams = {}) =>
    unwrap(
      $fetch<ApiEnvelope<CustomThemesListData>>(`${BASE}${buildListQuery(params)}`, AUTH_FETCH),
    )

  const getMine = (id: string) =>
    unwrap($fetch<ApiEnvelope<CustomThemeDetailData>>(`${BASE}/${id}`, AUTH_FETCH))

  const submit = (formData: FormData) =>
    unwrap(
      $fetch<ApiEnvelope<CustomThemeSubmitData>>(BASE, {
        ...AUTH_FETCH,
        method: 'POST',
        body: formData,
      }),
    )

  const updateMetadata = (id: string, patch: CustomThemeMetadataPatch) =>
    unwrap(
      $fetch<ApiEnvelope<{ theme: CustomThemeDetailData['theme'] }>>(`${BASE}/${id}`, {
        ...AUTH_FETCH,
        method: 'PUT',
        body: patch,
      }),
    )

  const replaceFiles = (id: string, formData: FormData) =>
    unwrap(
      $fetch<ApiEnvelope<CustomThemeSubmitData>>(`${BASE}/${id}/files`, {
        ...AUTH_FETCH,
        method: 'POST',
        body: formData,
      }),
    )

  const remove = (id: string) =>
    unwrap(
      $fetch<ApiEnvelope<{ message: string; id: string }>>(`${BASE}/${id}`, {
        ...AUTH_FETCH,
        method: 'DELETE',
      }),
    )

  return {
    listMine,
    getMine,
    submit,
    updateMetadata,
    replaceFiles,
    remove,
    formatThemeDate,
    parseCustomThemesError,
  }
}
