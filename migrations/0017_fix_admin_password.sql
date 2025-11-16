-- Fix admin user password to match expected hash for 'admin123'
-- This ensures the admin user can log in with password: admin123
-- Hash: SHA-256 of 'admin123'

UPDATE users
SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
WHERE email = 'admin@deeds.local';

-- Verify the admin user has correct role and verification status
UPDATE users
SET
  role = 'admin',
  verification_status = 'verified'
WHERE email = 'admin@deeds.local';
