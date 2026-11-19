ALTER TABLE users ADD COLUMN discord_id TEXT;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL;

-- Existing accounts treated as verified until an admin changes email or user re-verifies.
UPDATE users SET email_verified_at = unixepoch() WHERE email_verified_at IS NULL;