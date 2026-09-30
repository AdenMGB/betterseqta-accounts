-- Shared encryption root for timetable classmates relay (same for all opted-in students on instance)
ALTER TABLE tq_instance ADD COLUMN relay_bundle_key_b64 TEXT;
