-- Web Push obunalari — har foydalanuvchi browser/qurilmasi alohida.
-- VAPID asoslangan push notifications uchun.
-- Yaratish: npx wrangler d1 migrations apply niyat

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,                                  -- NULL = anonymous (login qilmagan)
  endpoint    TEXT NOT NULL UNIQUE,                  -- push service URL
  p256dh      TEXT NOT NULL,                         -- encryption key
  auth        TEXT NOT NULL,                         -- auth secret
  user_agent  TEXT,                                  -- qurilma identifikatsiya uchun
  created_at  INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_created ON push_subscriptions(created_at);
