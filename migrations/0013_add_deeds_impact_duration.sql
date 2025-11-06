-- Add impact and duration metadata columns to deeds table
-- These store the impact category and time commitment from deed_catalog selections

ALTER TABLE deeds ADD COLUMN impact TEXT DEFAULT '';
ALTER TABLE deeds ADD COLUMN duration TEXT DEFAULT '';

-- Update existing deeds to have default values
UPDATE deeds SET impact = COALESCE(impact, '');
UPDATE deeds SET duration = COALESCE(duration, '');

-- Rollback
-- ALTER TABLE deeds DROP COLUMN impact;
-- ALTER TABLE deeds DROP COLUMN duration;
