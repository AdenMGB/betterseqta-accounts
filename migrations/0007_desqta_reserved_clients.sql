-- Desqta reserved clients: allows unauthenticated users to reserve a client_id before login
-- Each DesQTA app instance can call POST /api/desqta/client/reserve to get a unique client_id
CREATE TABLE IF NOT EXISTS desqta_reserved_clients (
    id TEXT PRIMARY KEY,
    redirect_uri TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_desqta_reserved_clients_created ON desqta_reserved_clients(created_at);
