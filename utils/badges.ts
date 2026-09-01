/** Founder badge tiers — keep in sync with worker/src/lib/badges.ts */

export const BADGE_TIERS = [
  {
    key: 'founder_10',
    label: 'Pioneer',
    threshold: 10,
    rankLabel: 'Top 10',
    description: 'One of the first 10 people to create a BetterSEQTA Cloud account.',
  },
  {
    key: 'founder_25',
    label: 'Early Adopter',
    threshold: 25,
    rankLabel: 'Top 25',
    description: 'One of the first 25 people to join BetterSEQTA Cloud.',
  },
  {
    key: 'founder_50',
    label: 'Founding Member',
    threshold: 50,
    rankLabel: 'Top 50',
    description: 'One of the first 50 Cloud members, early supporter of BetterSEQTA.',
  },
  {
    key: 'founder_100',
    label: 'Centurion',
    threshold: 100,
    rankLabel: 'Top 100',
    description: 'Among the first 100 BetterSEQTA Cloud accounts ever created.',
  },
  {
    key: 'founder_250',
    label: 'Quarter Thousand',
    threshold: 250,
    rankLabel: 'Top 250',
    description: 'One of the first 250 people to sign up for BetterSEQTA Cloud.',
  },
  {
    key: 'founder_500',
    label: 'Half Thousand',
    threshold: 500,
    rankLabel: 'Top 500',
    description: 'Among the first 500 BetterSEQTA Cloud members.',
  },
  {
    key: 'founder_1000',
    label: 'Thousand Club',
    threshold: 1000,
    rankLabel: 'Top 1,000',
    description: 'One of the first 1,000 BetterSEQTA Cloud accounts.',
  },
  {
    key: 'founder_2500',
    label: 'Founding Cloud',
    threshold: 2500,
    rankLabel: 'Top 2,500',
    description: 'One of the first 2,500 Cloud members.',
  },
] as const

export type BadgeKey = (typeof BADGE_TIERS)[number]['key']

export type BadgeItem = {
  key: string
  label: string
  awarded_at?: number
}

const TIER_BY_KEY = new Map(BADGE_TIERS.map((t) => [t.key, t]))

export function tierForBadgeKey(key: string) {
  return TIER_BY_KEY.get(key as BadgeKey)
}

export function badgeRankLabel(key: string): string {
  return tierForBadgeKey(key)?.rankLabel ?? ''
}

export function badgeDescription(key: string): string {
  return tierForBadgeKey(key)?.description ?? 'A founder badge linked to your BetterSEQTA Cloud account.'
}

export function primaryFounderBadgeKey(signupNumber: number): BadgeKey | null {
  const tier = BADGE_TIERS.find((t) => signupNumber <= t.threshold)
  return tier?.key ?? null
}

export function pickPrimaryFounderBadge(
  badges: BadgeItem[],
  signupNumber?: number | null,
): BadgeItem | null {
  if (signupNumber != null) {
    const key = primaryFounderBadgeKey(signupNumber)
    if (!key) return null
    return badges.find((b) => b.key === key) ?? { key, label: TIER_BY_KEY.get(key)?.label ?? key }
  }

  if (badges.length === 0) return null

  let best: BadgeItem | null = null
  let bestThreshold = Infinity
  for (const badge of badges) {
    const tier = TIER_BY_KEY.get(badge.key as BadgeKey)
    if (tier && tier.threshold < bestThreshold) {
      bestThreshold = tier.threshold
      best = badge
    }
  }
  return best
}

export function displayFounderBadges(
  badges: BadgeItem[],
  signupNumber?: number | null,
): BadgeItem[] {
  const primary = pickPrimaryFounderBadge(badges, signupNumber)
  return primary ? [primary] : []
}
