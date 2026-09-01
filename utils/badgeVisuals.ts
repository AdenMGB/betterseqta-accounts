/** Soft blob colours for frosted founder badges — keep tier keys in sync with utils/badges.ts */

export type BadgeVisual = {
  /** Dark base behind blobs */
  base: string
  blobs: [string, string, string]
}

export const BADGE_VISUALS: Record<string, BadgeVisual> = {
  founder_10: {
    base: '#78350f',
    blobs: ['rgba(251,191,36,0.58)', 'rgba(234,88,12,0.48)', 'rgba(254,243,199,0.42)'],
  },
  founder_25: {
    base: '#1e3a8a',
    blobs: ['rgba(79,70,229,0.52)', 'rgba(37,99,235,0.46)', 'rgba(129,140,248,0.38)'],
  },
  founder_50: {
    base: '#0c4a6e',
    blobs: ['rgba(2,132,199,0.5)', 'rgba(13,148,136,0.44)', 'rgba(56,189,248,0.36)'],
  },
  founder_100: {
    base: '#064e3b',
    blobs: ['rgba(5,150,105,0.5)', 'rgba(22,163,74,0.44)', 'rgba(52,211,153,0.36)'],
  },
  founder_250: {
    base: '#7c2d12',
    blobs: ['rgba(217,119,6,0.52)', 'rgba(234,88,12,0.46)', 'rgba(251,191,36,0.38)'],
  },
  founder_500: {
    base: '#7c2d12',
    blobs: ['rgba(234,88,12,0.52)', 'rgba(249,115,22,0.46)', 'rgba(251,146,60,0.38)'],
  },
  founder_1000: {
    base: '#881337',
    blobs: ['rgba(225,29,72,0.5)', 'rgba(219,39,119,0.44)', 'rgba(251,113,133,0.36)'],
  },
  founder_2500: {
    base: '#713f12',
    blobs: ['rgba(245,158,11,0.52)', 'rgba(234,179,8,0.46)', 'rgba(252,211,77,0.4)'],
  },
}

export function badgeVisualForKey(key: string): BadgeVisual {
  return (
    BADGE_VISUALS[key] ?? {
      base: '#1e293b',
      blobs: ['rgba(59,130,246,0.5)', 'rgba(249,115,22,0.44)', 'rgba(148,163,184,0.36)'],
    }
  )
}

export function badgeBlobStyle(key: string): Record<string, string> {
  const visual = badgeVisualForKey(key)
  return {
    '--badge-base': visual.base,
    '--badge-blob-a': visual.blobs[0],
    '--badge-blob-b': visual.blobs[1],
    '--badge-blob-c': visual.blobs[2],
  }
}
