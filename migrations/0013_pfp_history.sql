-- Track previous profile pictures for revert capability
CREATE TABLE IF NOT EXISTS pfp_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pfp_history_user ON pfp_history(user_id);
