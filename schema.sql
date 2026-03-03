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

-- Desqta Reserved Clients (dynamic client_id reservation, no admin pre-registration)
-- expires_at: 7-day TTL, refreshed on use (config, login, refresh, Discord OAuth)
CREATE TABLE IF NOT EXISTS desqta_reserved_clients (
    id TEXT PRIMARY KEY,
    redirect_uri TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER
);

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

