-- Track who created each OAuth client for per-creator delete permissions
ALTER TABLE oauth_clients ADD COLUMN created_by TEXT;
