-- Shared long-lived user sessions for web, DesQTA, and BetterSEQTA Plus
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    client_id TEXT,
    refresh_token_hash TEXT NOT NULL,
    session_family_id TEXT,
    device_name TEXT,
    user_agent TEXT,
    created_ip TEXT,
    last_ip TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    last_used_at INTEGER,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_platform ON user_sessions(platform);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON user_sessions(revoked_at);

INSERT INTO user_sessions (
    id,
    user_id,
    platform,
    client_id,
    refresh_token_hash,
    device_name,
    created_at,
    last_used_at,
    expires_at,
    revoked_at
)
SELECT
    id,
    user_id,
    'desqta',
    client_id,
    refresh_token_hash,
    device_id,
    created_at,
    last_used_at,
    expires_at,
    NULL
FROM desqta_sessions
WHERE NOT EXISTS (
    SELECT 1 FROM user_sessions existing WHERE existing.id = desqta_sessions.id
);
