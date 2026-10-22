-- Account-level flag: current hosted PFP should appear in admin audit queue.
ALTER TABLE users ADD COLUMN pfp_pending_review INTEGER NOT NULL DEFAULT 0;

-- Existing hosted profile pictures (content hash) enter the review queue once.
UPDATE users SET pfp_pending_review = 1 WHERE pfp_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS pfp_audit_admin_views (
  admin_user_id TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  pfp_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (admin_user_id, subject_user_id, pfp_hash)
);

CREATE TABLE IF NOT EXISTS pfp_audit_acceptances (
  admin_user_id TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  pfp_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (admin_user_id, subject_user_id, pfp_hash)
);

CREATE INDEX IF NOT EXISTS idx_pfp_audit_views_subject ON pfp_audit_admin_views(subject_user_id, pfp_hash);
CREATE INDEX IF NOT EXISTS idx_pfp_audit_accept_subject ON pfp_audit_acceptances(subject_user_id, pfp_hash);
