-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    displayName TEXT,
    pfpUrl TEXT,
    admin_level INTEGER DEFAULT 0, -- 0 = user, 1 = junior admin, 2 = middle admin, 3 = senior admin
    created_at INTEGER DEFAULT (unixepoch())
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY,
    data TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Settings sync metadata (DesQTA sync-init); no FK to users — same as settings
CREATE TABLE IF NOT EXISTS settings_metadata (
    user_id TEXT PRIMARY KEY,
    settings_revision INTEGER NOT NULL DEFAULT 1,
    settings_updated_at TEXT NOT NULL,
    content_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_settings_metadata_user_id ON settings_metadata(user_id);

-- Desqta Reserved Clients (dynamic client_id reservation, no admin pre-registration)
-- expires_at: 7-day TTL, refreshed on use (config, login, refresh, Discord OAuth)
CREATE TABLE IF NOT EXISTS desqta_reserved_clients (
    id TEXT PRIMARY KEY,
    redirect_uri TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER
);

-- Shared user sessions across web, DesQTA, and BetterSEQTA Plus
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

-- OAuth Clients Table
CREATE TABLE IF NOT EXISTS oauth_clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    secret TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
);

-- OAuth Codes Table
CREATE TABLE IF NOT EXISTS oauth_codes (
    code TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
);

-- API Keys (for Discord bot stats, etc.)
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
);

