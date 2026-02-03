-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    displayName TEXT,
    pfpUrl TEXT,
    is_admin BOOLEAN DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY,
    data TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
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

