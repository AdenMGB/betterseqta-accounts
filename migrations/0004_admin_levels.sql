-- Migrate from is_admin BOOLEAN to admin_level INTEGER
-- admin_level: 0 = regular user, 1 = junior admin, 2 = middle admin, 3+ = higher admin levels
-- The highest admin_level in the system is considered the "Senior Admin" level
-- This allows for future expansion of admin levels without code changes

-- First, add the new column
ALTER TABLE users ADD COLUMN admin_level INTEGER DEFAULT 0;

-- Migrate existing data: convert is_admin (BOOLEAN) to admin_level (INTEGER)
-- If is_admin = 1 (true), set admin_level = 1 (junior admin)
-- If is_admin = 0 (false), set admin_level = 0 (regular user)
UPDATE users SET admin_level = CASE WHEN is_admin = 1 THEN 1 ELSE 0 END;

-- Drop the old column (SQLite doesn't support DROP COLUMN directly, so we'll need to recreate the table)
-- For now, we'll keep both columns and handle the transition in code
-- In production, you may want to recreate the table without is_admin
