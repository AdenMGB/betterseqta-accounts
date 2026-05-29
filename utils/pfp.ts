/** Current PFP lives at a stable URL that gets overwritten; history blobs are immutable. */
export function isMutablePfpUrl(url: string): boolean {
  if (!url.includes('/api/user/pfp/')) return false
  // /api/user/pfp/{userId}/hist/{id} — immutable history
  if (url.includes('/hist/')) return false
  // /api/user/pfp/{userId} — mutable current slot
  return /^\/api\/user\/pfp\/[^/?#]+$/.test(url.split('?')[0]!)
}

export function withPfpCacheBust(url: string | null | undefined, version?: number | string): string {
  if (!url) return ''
  if (!isMutablePfpUrl(url)) return url
  const base = url.split('?')[0]!
  return `${base}?v=${version ?? Date.now()}`
}

export function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now()
  const then = unixSeconds * 1000
  const diffSec = Math.round((then - now) / 1000)
  const abs = Math.abs(diffSec)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 604800), 'week')
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}

export function dicebearUrl(userId: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
}
