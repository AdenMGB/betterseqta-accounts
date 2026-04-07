-- BetterSEQTA+ extension cloud backup (chrome.storage.local snapshot per user)
-- Separate from DesQTA `settings` table; envelope { schemaVersion, data } stored as columns + JSON data map.

CREATE TABLE IF NOT EXISTS bsplus_settings_sync (
  user_id TEXT NOT NULL PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
