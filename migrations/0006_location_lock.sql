-- Joylashuv qulfi — admin tomonidan boshqariladigan flag.
-- 1 = qulflangan (foydalanuvchi ozi ochira olmaydi)
-- 0 = ochiq (foydalanuvchi ozi ochirishi mumkin)
-- Default 1: yangi foydalanuvchilar uchun joylashuv majburiy (juma masjid + real namoz vaqtlari uchun).

ALTER TABLE users ADD COLUMN location_lock INTEGER NOT NULL DEFAULT 1;
