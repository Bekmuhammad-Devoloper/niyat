-- Niyat backend boshlang'ich schema
-- Yaratish: npx wrangler d1 migrations apply niyat
-- Lokal dev: npx wrangler d1 migrations apply niyat --local

-- ============================================================
-- USERS — foydalanuvchilar
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,                  -- UUID
  phone           TEXT NOT NULL UNIQUE,              -- "+998901234567"
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL DEFAULT '',
  password_hash   TEXT NOT NULL,                     -- SHA-256
  is_premium      INTEGER NOT NULL DEFAULT 0,        -- 0/1
  premium_expires_at INTEGER,                        -- millis epoch, NULL = yo'q
  photo_data_url  TEXT,
  created_at      INTEGER NOT NULL,                  -- millis epoch
  updated_at      INTEGER NOT NULL,
  last_active_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);

-- ============================================================
-- SESSIONS — auth tokenlari
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,                      -- UUID
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,                      -- millis epoch
  expires_at  INTEGER NOT NULL,                      -- 90 kun
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- AI_LOGS — har AI so'rovi (optional, tahlil uchun)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_logs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT,
  provider     TEXT NOT NULL,                        -- gemini | openai | anthropic
  endpoint     TEXT NOT NULL,                        -- coach | tts | sunnat-simplify
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd     REAL NOT NULL DEFAULT 0.0,
  status       INTEGER NOT NULL,                     -- HTTP status
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_provider ON ai_logs(provider);
