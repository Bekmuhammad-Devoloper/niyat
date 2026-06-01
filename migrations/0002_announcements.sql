-- Admin e'lonlari — barcha foydalanuvchilarga ko'rsatiladigan xabarlar
-- Yaratish: npx wrangler d1 migrations apply niyat

CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal',     -- normal | important | critical
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER                              -- NULL = doimiy
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at);

-- Foydalanuvchi o'qigan e'lonlar
CREATE TABLE IF NOT EXISTS user_announcement_reads (
  user_id         TEXT NOT NULL,
  announcement_id TEXT NOT NULL,
  read_at         INTEGER NOT NULL,
  PRIMARY KEY (user_id, announcement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);
