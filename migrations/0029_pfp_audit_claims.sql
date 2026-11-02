-- In-progress PFP audit assignments (one subject+pfp_hash claimed by one admin at a time).
CREATE TABLE IF NOT EXISTS pfp_audit_claims (
  subject_user_id TEXT NOT NULL,
  pfp_hash TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (subject_user_id, pfp_hash)
);

CREATE INDEX IF NOT EXISTS idx_pfp_audit_claims_admin ON pfp_audit_claims(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_pfp_audit_claims_expires ON pfp_audit_claims(expires_at);
