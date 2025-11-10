-- Create admin user for testing verification queue
-- Password will be 'admin123' (8+ chars required)
-- Hash: SHA-256 of 'admin123'

INSERT INTO users (name, email, password_hash, role, credits, verification_status, created_at)
VALUES (
  'Admin User',
  'admin@deeds.local',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'admin',
  0,
  'verified',
  datetime('now')
)
ON CONFLICT(email) DO UPDATE SET
  role = 'admin',
  verification_status = 'verified';
