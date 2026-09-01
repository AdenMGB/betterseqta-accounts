/** Founder badge tiers — keep in sync with worker/src/lib/badges.ts */

export const BADGE_TIERS = [
  { key: 'founder_10', label: 'Pioneer', threshold: 10 },
  { key: 'founder_25', label: 'Early Adopter', threshold: 25 },
  { key: 'founder_50', label: 'Founding Member', threshold: 50 },
  { key: 'founder_100', label: 'Centurion', threshold: 100 },
  { key: 'founder_250', label: 'Quarter Thousand', threshold: 250 },
  { key: 'founder_500', label: 'Half Thousand', threshold: 500 },
  { key: 'founder_1000', label: 'Thousand Club', threshold: 1000 },
  { key: 'founder_2500', label: 'Founding Cloud', threshold: 2500 },
] as const

export type BadgeKey = (typeof BADGE_TIERS)[number]['key']

export type BadgeItem = {
  key: string
  label: string
  awarded_at?: number
}

const TIER_BY_KEY = new Map(BADGE_TIERS.map((t) => [t.key, t]))

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
