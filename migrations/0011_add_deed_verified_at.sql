-- Track when deeds are verified so we can surface status badges and metrics.
ALTER TABLE deeds ADD COLUMN verified_at TEXT;

-- Populate existing verified deeds with a timestamp if missing.
UPDATE deeds
SET verified_at = COALESCE(verified_at, datetime('now'))
WHERE status = 'verified';

-- Rollback
-- ALTER TABLE deeds DROP COLUMN verified_at;
