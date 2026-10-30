import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AWARDABLE_BADGE_KEYS,
  displayUserBadges,
  isAwardableBadgeKey,
  labelForBadgeKey,
  type UserBadge,
} from "../src/lib/badges.ts";

describe("badges", () => {
  it("labelForBadgeKey resolves founder and achievement badges", () => {
    assert.equal(labelForBadgeKey("founder_10"), "Pioneer");
    assert.equal(labelForBadgeKey("theme_submitter"), "Theme Submitter");
  });

  it("isAwardableBadgeKey only allows achievement badges", () => {
    assert.equal(isAwardableBadgeKey("theme_submitter"), true);
    assert.equal(isAwardableBadgeKey("founder_10"), false);
    assert.equal(AWARDABLE_BADGE_KEYS.has("theme_submitter"), true);
  });

  it("displayUserBadges includes founder primary and achievement badges", () => {
    const raw: UserBadge[] = [
      { key: "founder_100", label: "Centurion", awarded_at: 1 },
      { key: "theme_submitter", label: "Theme Submitter", awarded_at: 2 },
    ];
    const displayed = displayUserBadges(raw, 50);
    assert.equal(displayed.length, 2);
    assert.equal(displayed[0]?.key, "founder_50");
    assert.equal(displayed[1]?.key, "theme_submitter");
  });

  it("displayUserBadges returns achievement-only when no founder tier", () => {
    const raw: UserBadge[] = [{ key: "theme_submitter", label: "Theme Submitter", awarded_at: 2 }];
    const displayed = displayUserBadges(raw, null);
    assert.deepEqual(
      displayed.map((b) => b.key),
      ["theme_submitter"],
    );
  });
});
