# Badges — client integration guide

How to show user badges in a frontend (Accounts, BetterSEQTA.org, BS+, or any app that reads Cloud profiles). Server-side awarding is documented in [api-badges-award.md](./api-badges-award.md).

---

## Badge data model

Each badge in API responses looks like:

```json
{
  "key": "theme_submitter",
  "label": "Theme Submitter",
  "awarded_at": 1710100000
}
```

| Field | Description |
|-------|-------------|
| `key` | Stable identifier. Use this for logic and styling—not `label`. |
| `label` | Human-readable name from the server (safe to display). |
| `awarded_at` | Unix timestamp (seconds) when the badge was granted, when present. |

Users also have **`signup_number`** (integer or null) and **`admin_level`** (0 = normal user). Those are not entries in `badges[]` but often appear **next to** badges in the UI.

---

## Part A — Theme Submitter badge (client-side)

### When it appears

The **Theme Submitter** badge exists only after Accounts has stored `theme_submitter` for that user (via the interop API when a theme is accepted). The client does not grant badges; it only **reads** them.

After a successful award on the server, refresh the user profile so the new badge shows up (see [Refreshing badge data](#refreshing-badge-data)).

### Detecting the badge

```typescript
type BadgeItem = { key: string; label: string; awarded_at?: number }

function hasThemeSubmitterBadge(badges: BadgeItem[] | undefined): boolean {
  return (badges ?? []).some((b) => b.key === 'theme_submitter')
}

function themeSubmitterBadge(badges: BadgeItem[] | undefined): BadgeItem | undefined {
  return (badges ?? []).find((b) => b.key === 'theme_submitter')
}
```

Do not rely on `label === 'Theme Submitter'`—labels could change; **`key` is canonical**.

### Where to load badges from

| Context | Source |
|---------|--------|
| Accounts web app (logged-in user) | `GET /api/auth/me` → user object includes `badges`, `signup_number`, `admin_level` |
| Another site with Accounts API key | `GET /api/v1/users/{userId}/profile` (scope `users:read`) or `GET /api/v1/users/badges/{userId}` (scope `badges:read`) |
| BS+ after login | Login/refresh `user` payload from Accounts (same fields when enriched) |

Example profile fragment:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "displayName": "Alex",
  "signup_number": 842,
  "admin_level": 0,
  "badges": [
    { "key": "founder_1000", "label": "Thousand Club", "awarded_at": 1700000000 },
    { "key": "theme_submitter", "label": "Theme Submitter", "awarded_at": 1710100000 }
  ]
}
```

Note: the `badges` array is already **filtered for display** on the server (one founder tier + all achievement badges). You should still treat founder vs achievement separately when building UI (Part B).

### Accounts app (this repo)

Reference implementation:

1. Pass `badges` and `signup_number` into **`ProfileBadgeStack`** (`components/badges/ProfileBadgeStack.vue`).
2. Metadata (descriptions, rank labels): **`utils/badges.ts`** → `ACHIEVEMENT_BADGES`, `badgeDescription`, `badgeRankLabel`.
3. Colours: **`utils/badgeVisuals.ts`** → `theme_submitter` entry and `badgeBlobStyle(key)`.
4. Pill UI: **`UserBadge`** + **`FounderBadgeGlass`** (shared glass pill for founder and achievement keys).

Example (settings profile):

```vue
<ProfileBadgeStack
  v-if="auth.user.value"
  :admin-level="auth.user.value.admin_level ?? 0"
  :signup-number="auth.user.value.signup_number"
  :badges="auth.user.value.badges ?? []"
/>
```

`ProfileBadgeStack` renders achievement badges (including `theme_submitter`) in a `v-for` after the single founder pill.

### External site (minimal UI)

If you are not using the Accounts Vue components, a minimal approach:

1. Fetch badges (profile or badges endpoint).
2. Split founder vs achievements (see Part B helpers).
3. For Theme Submitter only, render a chip when `hasThemeSubmitterBadge(badges)`.

```tsx
// React-style example
function ThemeSubmitterChip({ badges }: { badges: BadgeItem[] }) {
  const badge = badges.find((b) => b.key === 'theme_submitter')
  if (!badge) return null
  return (
    <span className="badge badge-theme-submitter" title={badge.label}>
      {badge.label}
    </span>
  )
}
```

Optional: match Accounts styling using CSS variables from `utils/badgeVisuals.ts` (`theme_submitter.base` and blob colours).

### Copy and tooltips

For Theme Submitter, recommended strings (keep in sync with `utils/badges.ts`):

| Use | Text |
|-----|------|
| Label | Theme Submitter |
| Rank / subtitle | Community |
| Description | Submitted a custom theme that was accepted into the BetterSEQTA theme gallery. |

### Refreshing badge data

Badges are not pushed to the client. After your backend calls `POST .../badges` with `theme_submitter`:

- **Accounts:** call `fetchUser()` from `useAuth()` (or reload the page).
- **SPA with JWT:** re-fetch `/api/auth/me` or `/api/v1/users/{id}/profile`.
- **Public profile pages:** refetch on navigation or use cache TTL; do not assume badges are static forever.

---

## Part B — Multiple badges per user

A single user can qualify for **several** badge *types* at once. The UI rules below are how Accounts behaves and what the public API returns.

### Three UI categories

| Category | Source | How many shown |
|----------|--------|----------------|
| **Admin role** | `admin_level > 0` | One role badge (separate component, not in `badges[]`) |
| **Founder** | `signup_number` + optional `founder_*` rows in DB | **At most one** pill—the most exclusive tier they qualify for |
| **Achievement** | Rows in `user_badges` for keys like `theme_submitter` | **All** earned achievement badges |

Display order in **`ProfileBadgeStack`**: admin role → founder pill → achievement pill(s) → optional `#signup_number` chip if they have a number but no founder pill.

### Server-side display rules

`displayUserBadges` (worker `lib/badges.ts` / responses from `/api/auth/me`, v1 profile, v1 badges):

1. Pick **one** founder badge from `signup_number` (smallest threshold the user still qualifies for).
2. Append **every** achievement badge present in storage (currently any row whose key is in `ACHIEVEMENT_BADGES`).
3. Do **not** expose every cumulative `founder_*` tier from the database—only the primary founder tier.

So a user might have rows `founder_100`, `founder_50`, … in D1 historically, but the API returns a single founder entry plus achievements.

### Client-side: split the list

Use the same rules as Accounts (`utils/badges.ts`):

```typescript
import {
  displayFounderBadges,
  achievementBadgesFromList,
  type BadgeItem,
} from '~/utils/badges' // or copy the logic into your app

function badgesForUi(
  badges: BadgeItem[],
  signupNumber: number | null | undefined,
) {
  const founder = displayFounderBadges(badges, signupNumber)[0] ?? null
  const achievements = achievementBadgesFromList(badges)
  return { founder, achievements }
}
```

**Portable logic without importing the repo:**

```typescript
const ACHIEVEMENT_KEYS = new Set(['theme_submitter'])

function isFounderKey(key: string) {
  return key.startsWith('founder_')
}

function achievementBadgesFromList(badges: BadgeItem[]) {
  return badges.filter((b) => ACHIEVEMENT_KEYS.has(b.key))
}

// Founder: trust API list — server already sends at most one founder_* .
// If you only have raw DB rows, compute primary from signup_number using BADGE_TIERS thresholds.
function founderFromApiList(badges: BadgeItem[]) {
  return badges.find((b) => isFounderKey(b.key)) ?? null
}
```

When consuming **v1 profile / auth/me**, prefer the server-filtered `badges` array: use `founderFromApiList` + `achievementBadgesFromList` rather than re-deriving founder tiers unless you have raw `user_badges` exports.

### Rendering multiple pills

- Use **`key`** as the React/Vue `:key` / list key.
- Render founder and achievements as **separate** components or loops so adding new achievement keys does not break founder layout.
- Achievement badges can wrap (`flex-wrap`) on narrow screens—see `ProfileBadgeStack` (`inline-flex flex-wrap gap-1.5`).

### Admin + founder + theme submitter example

User: `admin_level: 2`, `signup_number: 42`, badges:

```json
[
  { "key": "founder_50", "label": "Founding Member", "awarded_at": 1 },
  { "key": "theme_submitter", "label": "Theme Submitter", "awarded_at": 2 }
]
```

UI: **[Admin badge]** **[Founding Member]** **[Theme Submitter]** (three distinct pills).

### Future achievement badges

When new keys are added server-side:

1. Add to `ACHIEVEMENT_BADGES` in worker + `utils/badges.ts`.
2. Add visuals in `utils/badgeVisuals.ts` (and icon map in `FounderBadgeGlass.vue` if using Accounts components).
3. Clients that only check `theme_submitter` keep working; clients that render **all** achievements via `achievementBadgesFromList` show new badges automatically once metadata exists.

External apps should maintain their own `ACHIEVEMENT_KEYS` set (or fetch labels from the API and style unknown keys with a default).

### What not to do

- Do not show every `founder_*` tier from raw DB exports—users only see one founder pill.
- Do not grant `theme_submitter` in the browser; use [api-badges-award.md](./api-badges-award.md).
- Do not use theme id or submission id in place of Accounts **`user.id`** when awarding or fetching badges.

---

## Related docs

- [api-badges-award.md](./api-badges-award.md) — award/revoke `theme_submitter` from BetterSEQTA.org or other backends
- Accounts reference UI: `components/badges/ProfileBadgeStack.vue`, `utils/badges.ts`, `utils/badgeVisuals.ts`

### Admin dashboard (manual assignment)

Middle Admins (level 2+) can assign achievement badges to **any** user, including other admins.

1. **Admin → Users** → user row **⋯** menu → **Manage badges**
2. Toggle achievement badges (e.g. Theme Submitter). Founder tiers are not editable here—use **Signup Order** backfill instead.
3. Changes are audited as `user.badge.award` / `user.badge.revoke` in the activity log.

**Revoke rule:** moderators can remove achievement badges from normal users. For accounts with `admin_level > 0`, only that user can uncheck/remove their own badges (open **Manage badges** on your own row).
