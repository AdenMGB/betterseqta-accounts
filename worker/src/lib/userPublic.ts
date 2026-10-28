import type { Env } from "../types/env";
import { getUserBadges, isFounding2500, displayUserBadges, type UserBadge } from "./badges";
import { complianceFlagsFromRow } from "./userCompliance";

/** Columns for API user objects (camelCase pfpHash). */
export const USER_PUBLIC_SELECT =
  "id, email, username, displayName, pfpUrl, pfp_hash AS pfpHash, admin_level, signup_number, privacy_policy_accepted_at, terms_of_service_accepted_at, age_13_confirmed_at";

export type PublicUserRow = {
  id: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  pfpHash?: string | null;
  admin_level?: number;
  signup_number?: number | null;
  badges?: UserBadge[];
  is_founding_2500?: boolean;
  privacy_policy_accepted?: boolean;
  terms_of_service_accepted?: boolean;
  age_13_confirmed?: boolean;
};

export function mapUserPublic(row: Record<string, unknown> | null): PublicUserRow | null {
  if (!row) return null;
  const signupNumber =
    row.signup_number != null ? (row.signup_number as number) : (row.signupNumber as number | null | undefined);
  const compliance = complianceFlagsFromRow({
    privacy_policy_accepted_at: row.privacy_policy_accepted_at as number | null | undefined,
    terms_of_service_accepted_at: row.terms_of_service_accepted_at as number | null | undefined,
    age_13_confirmed_at: row.age_13_confirmed_at as number | null | undefined,
  });
  return {
    id: row.id as string,
    email: row.email as string | null | undefined,
    username: row.username as string | null | undefined,
    displayName: row.displayName as string | null | undefined,
    pfpUrl: row.pfpUrl as string | null | undefined,
    pfpHash: (row.pfpHash ?? row.pfp_hash ?? null) as string | null,
    admin_level: (row.admin_level as number) || 0,
    signup_number: signupNumber ?? null,
    is_founding_2500: isFounding2500(signupNumber ?? null),
    ...compliance,
  };
}

export function publicUserFromCredentials(row: Record<string, string>): PublicUserRow {
  const signupNumber = row.signup_number != null ? Number(row.signup_number) : null;
  const compliance = complianceFlagsFromRow({
    privacy_policy_accepted_at: row.privacy_policy_accepted_at != null ? Number(row.privacy_policy_accepted_at) : null,
    terms_of_service_accepted_at:
      row.terms_of_service_accepted_at != null ? Number(row.terms_of_service_accepted_at) : null,
    age_13_confirmed_at: row.age_13_confirmed_at != null ? Number(row.age_13_confirmed_at) : null,
  });
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    pfpUrl: row.pfpUrl,
    pfpHash: row.pfp_hash ?? null,
    admin_level: Number(row.admin_level) || 0,
    signup_number: signupNumber,
    is_founding_2500: isFounding2500(signupNumber),
    ...compliance,
  };
}

export async function enrichUserPublic(
  db: Env["DB"],
  user: PublicUserRow | null,
): Promise<PublicUserRow | null> {
  if (!user) return null;
  const badges = displayUserBadges(
    await getUserBadges(db, user.id),
    user.signup_number ?? null,
  );
  return {
    ...user,
    badges,
    is_founding_2500: isFounding2500(user.signup_number ?? null),
  };
}
