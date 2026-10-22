import { navigateTo } from '#app'

const STORAGE_KEY = 'post_login_redirect'

const BLOCKED_PATHS = new Set(['/login', '/register', '/reset-password'])

/** Relative in-app path only (open-redirect safe). */
export function isSafeInternalPath(path: string): boolean {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false
  if (path.includes('\\')) return false
  const pathname = path.split('?')[0].split('#')[0].replace(/\/$/, '') || '/'
  return !BLOCKED_PATHS.has(pathname)
}

export function setPostLoginRedirect(path: string): void {
  if (!process.client || !isSafeInternalPath(path)) return
  sessionStorage.setItem(STORAGE_KEY, path)
}

export function clearPostLoginRedirect(): void {
  if (!process.client) return
  sessionStorage.removeItem(STORAGE_KEY)
}

function redirectFromQuery(queryRedirect: unknown): string | null {
  const raw = Array.isArray(queryRedirect) ? queryRedirect[0] : queryRedirect
  if (typeof raw !== 'string' || !raw) return null
  return isSafeInternalPath(raw) ? raw : null
}

/** Prefer ?redirect=, then sessionStorage, then home. */
export function getPostLoginRedirect(queryRedirect: unknown): string {
  const fromQuery = redirectFromQuery(queryRedirect)
  if (fromQuery) return fromQuery

  if (process.client) {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored && isSafeInternalPath(stored)) return stored
  }

  return '/'
}

function authPageWithRedirect(path: '/login' | '/register', returnPath: string) {
  if (!isSafeInternalPath(returnPath) || returnPath === '/') {
    return { path }
  }
  return { path, query: { redirect: returnPath } }
}

export function loginLocation(returnPath: string) {
  return authPageWithRedirect('/login', returnPath)
}

export function registerLocation(returnPath: string) {
  return authPageWithRedirect('/register', returnPath)
}

export async function navigateAfterLogin(redirect: string): Promise<void> {
  clearPostLoginRedirect()
  const target = isSafeInternalPath(redirect) ? redirect : '/'
  await navigateTo(target)
}
