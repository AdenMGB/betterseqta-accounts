-- Add expires_at to desqta_reserved_clients (7-day TTL, refreshed on use)
ALTER TABLE desqta_reserved_clients ADD COLUMN expires_at INTEGER;

-- Set expires_at for existing rows: 7 days from created_at (or now if no created_at)
UPDATE desqta_reserved_clients SET expires_at = COALESCE(created_at, unixepoch()) + (7 * 24 * 60 * 60) WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_desqta_reserved_clients_expires ON desqta_reserved_clients(expires_at);
