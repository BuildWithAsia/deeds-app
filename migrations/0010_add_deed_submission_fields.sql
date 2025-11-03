-- Add optional description and category metadata to deeds submissions.
ALTER TABLE deeds ADD COLUMN description TEXT;
ALTER TABLE deeds ADD COLUMN category TEXT DEFAULT 'general';
UPDATE deeds SET category = COALESCE(category, 'general');

-- Rollback
-- ALTER TABLE deeds DROP COLUMN description;
-- ALTER TABLE deeds DROP COLUMN category;
