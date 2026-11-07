CREATE TABLE IF NOT EXISTS pm_backups (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pm_backups_created_at ON pm_backups(created_at);

CREATE TABLE IF NOT EXISTS pm_backup_photos (
  backup_id TEXT NOT NULL,
  history_id TEXT NOT NULL,
  photo_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (backup_id, history_id, photo_index),
  FOREIGN KEY (backup_id) REFERENCES pm_backups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pm_backup_photos_backup ON pm_backup_photos(backup_id);
