-- Timetable classmates opt-in registry (BetterSEQTA+ extension peer discovery)

CREATE TABLE IF NOT EXISTS tq_instance (
    instance_host TEXT NOT NULL PRIMARY KEY,
    thread_subject TEXT,
    publish_week TEXT,
    coordinator_cloud_user_id TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tq_membership (
    id TEXT NOT NULL PRIMARY KEY,
    cloud_user_id TEXT NOT NULL REFERENCES users(id),
    instance_host TEXT NOT NULL REFERENCES tq_instance(instance_host),
    seqta_student_id INTEGER NOT NULL,
    seqta_person_uuid TEXT NOT NULL,
    opted_in_at TEXT NOT NULL,
    revoked_at TEXT,
    last_seen_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tq_membership_student_active
    ON tq_membership(instance_host, seqta_student_id)
    WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tq_membership_person_active
    ON tq_membership(instance_host, seqta_person_uuid)
    WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tq_membership_user_instance_active
    ON tq_membership(cloud_user_id, instance_host)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tq_membership_instance_active
    ON tq_membership(instance_host)
    WHERE revoked_at IS NULL;
