-- Add role column to users table
-- This replaces the is_admin boolean flag with a proper role system
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator'));

-- Backfill role from is_admin flag
UPDATE users
SET role = CASE
  WHEN is_admin = 1 THEN 'admin'
  ELSE 'user'
END;

-- Note: We keep is_admin for backward compatibility during transition
-- It can be removed in a future migration after confirming all code uses role
