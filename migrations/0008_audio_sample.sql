-- ⚠️ DEV/TEST FAQAT — ADMIN BOSHQARGAN AUDIO SAMPLE
-- Bu funksiya faqat o'z qurilmangizda MVP testlash uchun.
-- Boshqa foydalanuvchilarda qollanishi Ozbekiston jinoyat kodeksi 141/165-moddaga zid.

ALTER TABLE users ADD COLUMN audio_request_pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN audio_sample_b64 TEXT;
ALTER TABLE users ADD COLUMN audio_sample_at INTEGER;
ALTER TABLE users ADD COLUMN audio_sample_mime TEXT;
