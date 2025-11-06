-- Fix admin user setup (migration 0009 had a DELETE that removed the admin)
-- This migration ensures admin user exists with a known password

INSERT INTO users (
  name,
  email,
  password_hash,
  credits,
  is_admin,
  role,
  created_at
)
VALUES (
  'Admin User',
  'admin@deeds.local',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', -- Password: admin123
  0,
  1,
  'admin',
  datetime('now')
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  password_hash = excluded.password_hash,
  is_admin = 1,
  role = 'admin';
