export function withPfpCacheBust(url: string | null | undefined, version?: number | string): string {
  if (!url) return ''
  if (!url.includes('/api/user/pfp/')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${version ?? Date.now()}`
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
