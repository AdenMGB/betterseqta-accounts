-- Normalize all existing email addresses to lowercase
-- This migration ensures all emails in the database are stored in lowercase
-- to support case-insensitive email handling in the application

-- Step 1: Handle potential duplicate emails (case-insensitive duplicates)
-- If there are emails like "User@Example.com" and "user@example.com", 
-- we need to keep only one (the oldest account) and delete the others.

-- Find and delete duplicate users (keeping the oldest one for each normalized email)
-- This handles the case where User@Example.com and user@example.com both exist
-- Remove case-insensitive duplicates (keep oldest id); no-op when none exist
DELETE FROM users
WHERE id IN (
    SELECT u.id
    FROM users u
    INNER JOIN users u2 ON LOWER(u.email) = LOWER(u2.email) AND u.id > u2.id
);

-- Step 2: Normalize remaining emails to lowercase (idempotent)
UPDATE users SET email = LOWER(email) WHERE email != LOWER(email);

-- Note: This migration handles the edge case where duplicate emails with different cases exist.
-- It keeps the oldest account (by id) and removes duplicates before normalizing.
-- All future emails will be normalized to lowercase by the application code.
