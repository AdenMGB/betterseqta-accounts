-- Terms of service acknowledgment (unix seconds, NULL = not yet accepted)
ALTER TABLE users ADD COLUMN terms_of_service_accepted_at INTEGER;
