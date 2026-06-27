/** Authenticated website API calls use HttpOnly session cookies. */
export const AUTH_FETCH = { credentials: 'include' as const }

export function withAuthFetch<T extends Record<string, unknown>>(options: T = {} as T): T & { credentials: 'include' } {
  return { ...options, credentials: 'include' }
}
