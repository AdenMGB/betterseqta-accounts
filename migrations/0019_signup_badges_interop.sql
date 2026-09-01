-- Signup order, founder badges, and interop API key scopes
ALTER TABLE users ADD COLUMN signup_number INTEGER;

CREATE TABLE IF NOT EXISTS user_badges (
    user_id TEXT NOT NULL REFERENCES users(id),
    badge_key TEXT NOT NULL,
    awarded_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, badge_key)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

ALTER TABLE api_keys ADD COLUMN scopes TEXT;
ALTER TABLE api_keys ADD COLUMN last_used_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_signup_number ON users(signup_number);

-- Backfill signup_number by account creation order (idempotent — only rows missing a number)
UPDATE users SET signup_number = (
    SELECT row_num FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS row_num
        FROM users
    ) AS ranked WHERE ranked.id = users.id
)
WHERE signup_number IS NULL;

-- Backfill cumulative founder badges for existing users
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_10' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 10;
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_25' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 25;
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_50' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 50;
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_100' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 100;
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_250' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 250;
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_500' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 500;
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_1000' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 1000;
INSERT OR IGNORE INTO user_badges (user_id, badge_key)
SELECT id, 'founder_2500' FROM users WHERE signup_number IS NOT NULL AND signup_number <= 2500;
