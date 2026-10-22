-- Privacy policy and age-13 acknowledgments (unix seconds, NULL = not yet accepted)
ALTER TABLE users ADD COLUMN privacy_policy_accepted_at INTEGER;
ALTER TABLE users ADD COLUMN age_13_confirmed_at INTEGER;
