-- BetterSEQTA+ extension install UUID ↔ cloud user (multi-browser devices)

CREATE TABLE IF NOT EXISTS bsplus_install_link (
    install_id TEXT NOT NULL PRIMARY KEY,
    cloud_user_id TEXT NOT NULL REFERENCES users(id),
    device_name TEXT,
    extension_json TEXT NOT NULL DEFAULT '{}',
    last_seen_at TEXT NOT NULL,
    linked_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bsplus_install_link_user
    ON bsplus_install_link(cloud_user_id);

CREATE INDEX IF NOT EXISTS idx_bsplus_install_link_last_seen
    ON bsplus_install_link(cloud_user_id, last_seen_at DESC);
