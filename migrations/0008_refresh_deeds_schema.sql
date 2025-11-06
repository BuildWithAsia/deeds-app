-- Rebuild deeds table with streamlined columns and credits tracking.
-- Note: D1 wraps migrations in transactions automatically, so we don't use BEGIN/COMMIT

CREATE TABLE deeds_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  proof_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  credits INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO deeds_new (id, user_id, title, proof_url, status, credits, created_at)
SELECT
  id,
  user_id,
  title,
  proof_url,
  status,
  CASE WHEN status = 'verified' THEN 1 ELSE 0 END AS credits,
  created_at
FROM deeds;

DROP TABLE deeds;
ALTER TABLE deeds_new RENAME TO deeds;

-- Rollback instructions (manual):
-- CREATE TABLE deeds_old AS SELECT id, user_id, title, proof_url, status, credits, created_at FROM deeds;
-- DROP TABLE deeds;
-- ALTER TABLE deeds_old RENAME TO deeds;
