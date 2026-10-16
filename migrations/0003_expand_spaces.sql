PRAGMA defer_foreign_keys = ON;
CREATE TABLE IF NOT EXISTS slots_expanded (id INTEGER PRIMARY KEY CHECK(id >= 1), token_hash TEXT NOT NULL UNIQUE);
INSERT OR REPLACE INTO slots_expanded(id,token_hash) SELECT id,token_hash FROM slots;
DROP TABLE slots;
ALTER TABLE slots_expanded RENAME TO slots;
WITH RECURSIVE numbers(id) AS (SELECT 1 UNION ALL SELECT id+1 FROM numbers WHERE id<40)
INSERT OR IGNORE INTO slots(id,token_hash) SELECT id,'auto:' || lower(hex(randomblob(32))) FROM numbers;
PRAGMA defer_foreign_keys = OFF;
