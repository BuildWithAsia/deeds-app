-- Create test pending deeds for verification queue testing

-- Ensure test user exists
INSERT INTO users (name, email, password_hash, role, credits, created_at)
VALUES ('Test User', 'test@example.com', 'test_hash', 'user', 0, datetime('now'))
ON CONFLICT(email) DO NOTHING;

-- Get user ID
-- Insert multiple pending deeds
INSERT INTO deeds (user_id, title, description, proof_url, status, created_at)
SELECT id, 'Neighborhood Clean-Up', 'Organized community clean-up event', 'https://example.com/proof1.jpg', 'pending', datetime('now', '-2 days')
FROM users WHERE email='test@example.com'
UNION ALL
SELECT id, 'Mentored a Student', 'Helped student with homework after school', 'https://example.com/proof2.jpg', 'pending', datetime('now', '-1 day')
FROM users WHERE email='test@example.com'
UNION ALL
SELECT id, 'Food Bank Volunteer', 'Volunteered 4 hours at local food bank', 'https://example.com/proof3.jpg', 'pending', datetime('now')
FROM users WHERE email='test@example.com';
