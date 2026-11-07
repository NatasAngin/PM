CREATE TABLE IF NOT EXISTS pm_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_photos (
  history_id TEXT NOT NULL,
  photo_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (history_id, photo_index)
);

CREATE INDEX IF NOT EXISTS idx_pm_photos_history ON pm_photos(history_id);
