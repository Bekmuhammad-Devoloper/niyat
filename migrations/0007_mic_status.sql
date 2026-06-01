-- Mikrofon "jonli" ekanini admin panelda korish uchun.
-- Foydalanuvchi ilovasi har eshitganda heartbeat yuboradi.

ALTER TABLE users ADD COLUMN mic_last_heard_at INTEGER;
ALTER TABLE users ADD COLUMN mic_last_text TEXT;
ALTER TABLE users ADD COLUMN mic_total_transcripts INTEGER NOT NULL DEFAULT 0;
