-- Final PFP audit choice per admin, subject, and picture hash (updated when decisions are revised).
CREATE TABLE IF NOT EXISTS pfp_audit_decisions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  pfp_hash TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accept', 'remove')),
  remove_reason TEXT,
  subject_username TEXT NOT NULL,
  subject_display_name TEXT,
  pfp_url TEXT NOT NULL,
  pfp_history_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(admin_user_id, subject_user_id, pfp_hash)
);

CREATE INDEX IF NOT EXISTS idx_pfp_audit_decisions_admin_updated
  ON pfp_audit_decisions(admin_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pfp_audit_decisions_updated
  ON pfp_audit_decisions(updated_at DESC);
