-- Namoz vaqtlari keshi — rasmiy jadval (Musulmonlar idorasi taqvimi) oylik
-- holda saqlanadi. Manba (namozvaqti.uz / islomapi.uz) yotib qolsa ham
-- ilova aniq vaqtlarni ko'rsatishda davom etadi.
CREATE TABLE IF NOT EXISTS prayer_cache (
  city        TEXT NOT NULL,          -- shahar slug'i (toshkent, samarqand, ...)
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,       -- 1..12
  source      TEXT NOT NULL,          -- namozvaqti.uz | islomapi.uz
  data_json   TEXT NOT NULL,          -- kunlar massivi (JSON)
  fetched_at  INTEGER NOT NULL,       -- millis epoch
  PRIMARY KEY (city, year, month)
);
