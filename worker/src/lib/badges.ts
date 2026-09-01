import type { Env } from "../types/env";

export const FOUNDING_2500_THRESHOLD = 2500;

export const BADGE_TIERS = [
  { key: "founder_10", label: "Pioneer", threshold: 10 },
  { key: "founder_25", label: "Early Adopter", threshold: 25 },
  { key: "founder_50", label: "Founding Member", threshold: 50 },
  { key: "founder_100", label: "Centurion", threshold: 100 },
  { key: "founder_250", label: "Quarter Thousand", threshold: 250 },
  { key: "founder_500", label: "Half Thousand", threshold: 500 },
  { key: "founder_1000", label: "Thousand Club", threshold: 1000 },
  { key: "founder_2500", label: "Founding Cloud", threshold: 2500 },
] as const;

export type BadgeKey = (typeof BADGE_TIERS)[number]["key"];

export type UserBadge = {
  key: string;
  label: string;
  awarded_at: number;
};

const TIER_BY_KEY = new Map(BADGE_TIERS.map((t) => [t.key, t]));

export function badgeKeysForSignupNumber(signupNumber: number): BadgeKey[] {
  return BADGE_TIERS.filter((t) => signupNumber <= t.threshold).map((t) => t.key);
}

/** Most exclusive founder tier: smallest threshold the signup number still qualifies for. */
export function primaryFounderBadgeKey(signupNumber: number): BadgeKey | null {
  const tier = BADGE_TIERS.find((t) => signupNumber <= t.threshold);
  return tier?.key ?? null;
}

export function pickPrimaryFounderBadge(
  badges: UserBadge[],
  signupNumber?: number | null,
): UserBadge | null {
  if (signupNumber != null) {
    const key = primaryFounderBadgeKey(signupNumber);
    if (!key) return null;
    const existing = badges.find((b) => b.key === key);
    if (existing) return existing;
    return {
      key,
      label: labelForBadgeKey(key),
      awarded_at: badges[0]?.awarded_at ?? Math.floor(Date.now() / 1000),
    };
  }

  if (badges.length === 0) return null;

  let best: UserBadge | null = null;
  let bestThreshold = Infinity;
  for (const badge of badges) {
    const tier = TIER_BY_KEY.get(badge.key as BadgeKey);
    if (tier && tier.threshold < bestThreshold) {
      bestThreshold = tier.threshold;
      best = badge;
    }
  }
  return best;
}

export function displayUserBadges(
  badges: UserBadge[],
  signupNumber?: number | null,
): UserBadge[] {
  const primary = pickPrimaryFounderBadge(badges, signupNumber);
  return primary ? [primary] : [];
}

export function isFounding2500(signupNumber: number | null | undefined): boolean {
  return signupNumber != null && signupNumber <= FOUNDING_2500_THRESHOLD;
}

export function labelForBadgeKey(key: string): string {
  return TIER_BY_KEY.get(key as BadgeKey)?.label ?? key;
}

/** Award the primary founder badge for a signup_number (idempotent). */
export async function awardBadgesForUser(
  db: Env["DB"],
  userId: string,
  signupNumber: number,
): Promise<void> {
  const badgeKey = primaryFounderBadgeKey(signupNumber);
  if (!badgeKey) return;

  await db
    .prepare(
      "INSERT OR IGNORE INTO user_badges (user_id, badge_key, awarded_at) VALUES (?, ?, unixepoch())",
    )
    .bind(userId, badgeKey)
    .run();
}

export async function getUserBadges(db: Env["DB"], userId: string): Promise<UserBadge[]> {
  try {
    const result = await db
      .prepare(
        "SELECT badge_key, awarded_at FROM user_badges WHERE user_id = ? ORDER BY awarded_at ASC",
      )
      .bind(userId)
      .all();
    return ((result.results ?? []) as { badge_key: string; awarded_at: number }[]).map((row) => ({
      key: row.badge_key,
      label: labelForBadgeKey(row.badge_key),
      awarded_at: row.awarded_at,
    }));
  } catch {
    return [];
  }
}

/** Remove all founder tier badges (used before a full signup-order recompute). */
export async function clearFounderBadges(db: Env["DB"]): Promise<number> {
  try {
    const result = await db.prepare("DELETE FROM user_badges WHERE badge_key LIKE 'founder_%'").run();
    return result.meta.changes ?? 0;
  } catch {
    return 0;
  }
}

/** Backfill badges for all users with signup_number (idempotent). */
export async function backfillAllBadges(db: Env["DB"]): Promise<number> {
  let rows: { id: string; signup_number: number }[];
  try {
    const result = await db
      .prepare("SELECT id, signup_number FROM users WHERE signup_number IS NOT NULL ORDER BY signup_number ASC")
      .all();
    rows = (result.results ?? []) as { id: string; signup_number: number }[];
  } catch {
    return 0;
  }

  for (const row of rows) {
    await awardBadgesForUser(db, row.id, row.signup_number);
  }
  return rows.length;
}
