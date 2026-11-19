const BSPLUS_ACCOUNTS_PATH = '/auth/bsplus/callback'
const BSPLUS_WEBSITE_CALLBACK_PATH = '/api/auth/callback'

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
    if (parsed.protocol === 'moz-extension:') {
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

function isAccountsBsplusHttpsCallback(uri: string): boolean {
  try {
    const parsed = new URL(uri.trim())
    const path = parsed.pathname.replace(/\/$/, '') || '/'
    if (path !== BSPLUS_ACCOUNTS_PATH) return false
    const host = parsed.hostname.toLowerCase()
    const allowed = new Set(['accounts.betterseqta.org', 'localhost', '127.0.0.1'])
    if (typeof window !== 'undefined') {
      try {
        allowed.add(window.location.hostname.toLowerCase())
      } catch {
        /* ignore */
      }
    }
    if (!allowed.has(host)) return false
    if (parsed.protocol === 'https:') return true
    return parsed.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')
  } catch {
    return false
  }
}

function isBetterseqtaWebsiteBsplusCallback(uri: string): boolean {
  try {
    const parsed = new URL(uri.trim())
    const path = parsed.pathname.replace(/\/$/, '') || '/'
    if (path !== BSPLUS_WEBSITE_CALLBACK_PATH) return false
    const host = parsed.hostname.toLowerCase()
    const allowed = new Set(['betterseqta.org', 'www.betterseqta.org', 'localhost', '127.0.0.1'])
    if (!allowed.has(host)) return false
    if (parsed.protocol === 'https:') return true
    return parsed.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')
  } catch {
    return false
  }
}

/** Match redirect_uri on consent screen (mirrors worker oauthRedirectUrisEquivalent). */
export function oauthRedirectUrisMatchForConsent(requested: string, registered: string): boolean {
  const req = requested.trim()
  const reg = registered.trim()
  if (req === reg) return true
  if (isAccountsBsplusHttpsCallback(req) && isAccountsBsplusHttpsCallback(reg)) return true
  if (isAccountsBsplusHttpsCallback(req) && isBetterseqtaWebsiteBsplusCallback(reg)) return true
  if (isBetterseqtaWebsiteBsplusCallback(req) && isAccountsBsplusHttpsCallback(reg)) return true
  try {
    const regUrl = new URL(reg)
    if (regUrl.protocol === 'chrome-extension:' || regUrl.protocol === 'moz-extension:') {
      if (isAccountsBsplusHttpsCallback(req)) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function buildOAuthAccessDeniedUrl(
  requestedUri: string | undefined,
  registeredUri: string | undefined,
): string | null {
  if (!requestedUri || !registeredUri) return null
  if (!oauthRedirectUrisMatchForConsent(requestedUri, registeredUri)) return null
  const target = requestedUri.trim()
  if (!isSafeOAuthRedirectUri(target)) return null
  const url = new URL(target)
  url.searchParams.set('error', 'access_denied')
  return url.toString()
}