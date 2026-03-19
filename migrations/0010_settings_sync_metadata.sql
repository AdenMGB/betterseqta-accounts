-- Settings sync metadata for DesQTA sync-init (revision / server time / optional hash)
-- Separate narrow row per user for cheap reads; bumps on each successful POST /api/settings

-- No FK to users: matches `settings` table — orphan user_id rows can exist if users were
-- removed before settings were cleaned up; backfill must not fail on those rows.
CREATE TABLE IF NOT EXISTS settings_metadata (
  user_id TEXT NOT NULL PRIMARY KEY,
  settings_revision INTEGER NOT NULL DEFAULT 1,
  settings_updated_at TEXT NOT NULL,
  content_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_settings_metadata_user_id ON settings_metadata(user_id);

-- Existing cloud settings: start at revision 1 with migration-time UTC timestamp
INSERT OR IGNORE INTO settings_metadata (user_id, settings_revision, settings_updated_at, content_hash)
SELECT user_id, 1, datetime('now'), NULL FROM settings;
