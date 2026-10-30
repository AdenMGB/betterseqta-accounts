-- Persisted ciphertext relay shares per SEQTA instance (survives DO restarts; snapshot source of truth)

CREATE TABLE IF NOT EXISTS tq_relay_share (
    instance_host TEXT NOT NULL REFERENCES tq_instance(instance_host),
    seqta_student_id INTEGER NOT NULL,
    cloud_user_id TEXT NOT NULL REFERENCES users(id),
    share_code TEXT NOT NULL,
    period_from TEXT NOT NULL,
    period_until TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    bundles_json TEXT NOT NULL,
    PRIMARY KEY (instance_host, seqta_student_id)
);

CREATE INDEX IF NOT EXISTS idx_tq_relay_share_instance
    ON tq_relay_share(instance_host);
