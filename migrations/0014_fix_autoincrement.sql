-- Fix autoincrement sequence for deeds table
-- This ensures the id column can properly auto-generate values

-- Reset the sqlite_sequence table to fix autoincrement
-- First, get the max id from deeds table, then update sqlite_sequence
UPDATE sqlite_sequence
SET seq = (SELECT COALESCE(MAX(id), 0) FROM deeds)
WHERE name = 'deeds';

-- If no entry exists in sqlite_sequence, insert one
INSERT OR IGNORE INTO sqlite_sequence (name, seq)
VALUES ('deeds', (SELECT COALESCE(MAX(id), 0) FROM deeds));

-- Rollback
-- This migration doesn't need rollback as it only fixes the sequence counter
