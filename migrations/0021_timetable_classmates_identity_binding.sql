-- Identity binding digest for timetable classmates opt-in / heartbeat cross-check
ALTER TABLE tq_membership ADD COLUMN identity_binding_digest TEXT;
ALTER TABLE tq_membership ADD COLUMN identity_binding_version INTEGER;
