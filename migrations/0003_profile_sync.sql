-- Profile sync — foydalanuvchi maqsadlari, niyatlari, statistikasi
-- lokal qurilmadan server'ga sinxronlanadi. Backup va boshqa qurilmaga
-- ko'chish uchun.
-- Yaratish: npx wrangler d1 migrations apply niyat

CREATE TABLE IF NOT EXISTS profile_data (
  user_id       TEXT NOT NULL,
  data_key      TEXT NOT NULL,   -- "goals" | "niyats" | "stats" | "settings"
  data_value    TEXT NOT NULL,   -- JSON-serialized payload
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, data_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_data_updated ON profile_data(updated_at);
