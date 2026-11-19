export function isSafeOAuthRedirectUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') return false
  const trimmed = uri.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:') return true
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true
    }
    if (parsed.protocol === 'chrome-extension:') {
      return parsed.pathname === '/auth/callback' || parsed.pathname.endsWith('/auth/callback')
    }
    if (parsed.protocol === 'desqta:' || parsed.protocol === 'bsplus:') {
      return Boolean(parsed.host || parsed.pathname.replace(/^\//, ''))
    }
    return false
  } catch {
    return false
  }
}

export function buildOAuthAccessDeniedUrl(
  requestedUri: string | undefined,
  registeredUri: string | undefined,
): string | null {
  if (!requestedUri || !registeredUri) return null
  if (requestedUri.trim() !== registeredUri.trim()) return null
  if (!isSafeOAuthRedirectUri(registeredUri)) return null
  const url = new URL(registeredUri.trim())
  url.searchParams.set('error', 'access_denied')
  return url.toString()
}