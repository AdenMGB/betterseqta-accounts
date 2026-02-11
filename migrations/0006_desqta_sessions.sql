-- Desqta sessions table for refresh token flow
CREATE TABLE IF NOT EXISTS desqta_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    device_id TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_desqta_sessions_user ON desqta_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_desqta_sessions_expires ON desqta_sessions(expires_at);
