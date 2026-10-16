CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  image_meta TEXT,
  video_meta TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_owner ON uploads(owner_hash,created_at);
