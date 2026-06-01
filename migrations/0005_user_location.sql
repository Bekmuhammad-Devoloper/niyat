-- Foydalanuvchi joriy joylashuvi — admin paneldan kuzatish uchun.
-- Mobil ilova "Joylashuvni ulashish" sozlamasini yoqsa, davriy yangilab boradi.
-- Dev'da ikkinchi marta qayta ishlatilsa, ALTER ENG xato bo'ladi — bu zararli emas
-- (ustun allaqachon mavjud). dev-d1 applyMigrations buni jim'cha qabul qiladi.

ALTER TABLE users ADD COLUMN latitude REAL;
ALTER TABLE users ADD COLUMN longitude REAL;
ALTER TABLE users ADD COLUMN location_accuracy_m REAL;
ALTER TABLE users ADD COLUMN location_updated_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_location_updated ON users(location_updated_at);
