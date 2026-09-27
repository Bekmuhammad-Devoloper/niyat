// Namoz vaqtlari backend — RASMIY jadval (O'zbekiston Musulmonlar idorasi
// taqvimi) shahar darajasida, daqiqasigacha aniq.
//
// GET /api/prayer/monthly?city=toshkent&year=2026&month=9
//
// Manba zanjiri:
//   1) D1 kesh (prayer_cache) — 14 kungacha yangi bo'lsa darhol qaytadi
//   2) namozvaqti.uz — /oylik/{oy}/{shahar} HTML jadvali (Musulmonlar idorasi
//      taqvim kitobi; 80+ shahar; hijriy kun ham rasmiy)
//   3) islomapi.uz — /api/monthly?region=...&month=... (viloyat darajasida)
//   4) eskirgan kesh (manbalar yotgan bo'lsa ham javob beramiz)
//
// Brauzer/APK to'g'ridan-to'g'ri chaqira olmaydi (CORS), shuning uchun proksi.
// Aladhan (hisoblangan) faqat client'da eng oxirgi zaxira — rasmiy jadvaldan
// 10-17 daqiqagacha farq qiladi.

import type { D1Database } from "../db/types";
import { findCity, type UzCity } from "../data/uz-cities";

export type PrayerDay = {
  day: number; // 1..31
  weekday: string; // Du, Se, Cho, Pa, Ju, Sha, Ya
  fajr: string; // "04:57"
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  hijriDay: number | null; // rasmiy hijriy (qamariy) kun
};

export type PrayerMonth = {
  city: string;
  cityName: string;
  region: string;
  year: number;
  month: number;
  source: string;
  fetchedAt: number;
  days: PrayerDay[];
};

const FRESH_MS = 14 * 24 * 60 * 60 * 1000;
const memCache = new Map<string, PrayerMonth>();

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
function normTime(t: string): string | null {
  const s = t.trim();
  if (!HHMM.test(s)) return null;
  const [h, m] = s.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

// ---------------------------------------------------------------------------
// 1-manba: namozvaqti.uz HTML jadvali
// ---------------------------------------------------------------------------
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNamozvaqtiMonthly(html: string): PrayerDay[] {
  const days: PrayerDay[] = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(stripTags);
    if (cells.length < 7) continue;
    // "27 Ya" → kun 27, hafta kuni Ya
    const m = /^(\d{1,2})\s*([A-Za-z']*)/.exec(cells[0]);
    if (!m) continue;
    const day = Number(m[1]);
    if (!(day >= 1 && day <= 31)) continue;
    const t = cells.slice(1, 7).map(normTime);
    if (t.some((x) => x === null)) continue;
    const hijri = cells[7] !== undefined ? Number(cells[7]) : NaN;
    days.push({
      day,
      weekday: m[2] || "",
      fajr: t[0]!,
      sunrise: t[1]!,
      dhuhr: t[2]!,
      asr: t[3]!,
      maghrib: t[4]!,
      isha: t[5]!,
      hijriDay: Number.isFinite(hijri) && hijri >= 1 && hijri <= 30 ? hijri : null,
    });
  }
  // Takroriy kunlarni olib tashlab, tartiblaymiz
  const byDay = new Map<number, PrayerDay>();
  for (const d of days) if (!byDay.has(d.day)) byDay.set(d.day, d);
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

async function fetchNamozvaqti(city: UzCity, month: number): Promise<PrayerDay[]> {
  const url = `https://namozvaqti.uz/oylik/${month}/${city.slug}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (NiyatApp; +https://niyat.tech)", accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`namozvaqti.uz ${res.status}`);
  const days = parseNamozvaqtiMonthly(await res.text());
  if (days.length < 28) throw new Error(`namozvaqti.uz: jadval to'liq emas (${days.length} kun)`);
  return days;
}

// ---------------------------------------------------------------------------
// 2-manba: islomapi.uz (viloyat)
// ---------------------------------------------------------------------------
type IslomUzDay = {
  day: number;
  weekday?: string;
  hijri_date?: { month: string; day: number };
  times: {
    tong_saharlik: string;
    quyosh: string;
    peshin: string;
    asr: string;
    shom_iftor: string;
    hufton: string;
  };
};

async function fetchIslomapi(city: UzCity, month: number): Promise<PrayerDay[]> {
  const url = `https://islomapi.uz/api/monthly?region=${encodeURIComponent(city.islomRegion)}&month=${month}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`islomapi.uz ${res.status}`);
  const list = (await res.json()) as IslomUzDay[];
  if (!Array.isArray(list) || list.length < 28) throw new Error("islomapi.uz: noto'g'ri javob");
  const days: PrayerDay[] = [];
  for (const d of list) {
    const t = [d.times.tong_saharlik, d.times.quyosh, d.times.peshin, d.times.asr, d.times.shom_iftor, d.times.hufton].map(normTime);
    if (t.some((x) => x === null)) continue;
    days.push({
      day: d.day,
      weekday: d.weekday ?? "",
      fajr: t[0]!,
      sunrise: t[1]!,
      dhuhr: t[2]!,
      asr: t[3]!,
      maghrib: t[4]!,
      isha: t[5]!,
      hijriDay: d.hijri_date?.day ?? null,
    });
  }
  return days.sort((a, b) => a.day - b.day);
}

// ---------------------------------------------------------------------------
// Kesh
// ---------------------------------------------------------------------------
type CacheRow = { source: string; data_json: string; fetched_at: number };

async function readCache(db: D1Database | undefined, city: string, year: number, month: number): Promise<CacheRow | null> {
  if (!db) return null;
  try {
    return await db
      .prepare("SELECT source, data_json, fetched_at FROM prayer_cache WHERE city = ? AND year = ? AND month = ?")
      .bind(city, year, month)
      .first<CacheRow>();
  } catch (err) {
    console.warn("[prayer] cache read failed", err);
    return null;
  }
}

async function writeCache(db: D1Database | undefined, m: PrayerMonth): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO prayer_cache (city, year, month, source, data_json, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(city, year, month) DO UPDATE SET
           source = excluded.source, data_json = excluded.data_json, fetched_at = excluded.fetched_at`,
      )
      .bind(m.city, m.year, m.month, m.source, JSON.stringify(m.days), m.fetchedAt)
      .run();
  } catch (err) {
    console.warn("[prayer] cache write failed", err);
  }
}

function build(city: UzCity, year: number, month: number, source: string, days: PrayerDay[], fetchedAt: number): PrayerMonth {
  return { city: city.slug, cityName: city.name, region: city.region, year, month, source, fetchedAt, days };
}

export async function getPrayerMonth(
  db: D1Database | undefined,
  city: UzCity,
  year: number,
  month: number,
): Promise<PrayerMonth> {
  const key = `${city.slug}:${year}:${month}`;
  const now = Date.now();

  const mem = memCache.get(key);
  if (mem && now - mem.fetchedAt < FRESH_MS) return mem;

  const cached = await readCache(db, city.slug, year, month);
  if (cached && now - cached.fetched_at < FRESH_MS) {
    try {
      const m = build(city, year, month, cached.source, JSON.parse(cached.data_json) as PrayerDay[], cached.fetched_at);
      memCache.set(key, m);
      return m;
    } catch {
      /* buzilgan kesh — qayta yuklaymiz */
    }
  }

  const errors: string[] = [];
  for (const [name, fn] of [
    ["namozvaqti.uz", () => fetchNamozvaqti(city, month)],
    ["islomapi.uz", () => fetchIslomapi(city, month)],
  ] as const) {
    try {
      const days = await fn();
      const m = build(city, year, month, name, days, now);
      memCache.set(key, m);
      await writeCache(db, m);
      return m;
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Hamma manba yotgan — eskirgan kesh bo'lsa ham beramiz
  if (cached) {
    try {
      const m = build(city, year, month, cached.source + " (kesh)", JSON.parse(cached.data_json) as PrayerDay[], cached.fetched_at);
      memCache.set(key, m);
      return m;
    } catch {
      /* ignore */
    }
  }
  if (mem) return mem;
  throw new Error(errors.join(" | "));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
export async function handlePrayerRequest(request: Request, db?: D1Database): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, { status: 405 });
  const url = new URL(request.url);
  if (url.pathname !== "/api/prayer/monthly") return json({ error: "Not found" }, { status: 404 });

  const city = findCity(url.searchParams.get("city") ?? "toshkent");
  if (!city) return json({ error: "Noma'lum shahar" }, { status: 400 });

  const nowUz = new Date(Date.now() + 5 * 60 * 60 * 1000); // UTC+5 (Toshkent)
  const year = Number(url.searchParams.get("year") ?? nowUz.getUTCFullYear());
  const month = Number(url.searchParams.get("month") ?? nowUz.getUTCMonth() + 1);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) {
    return json({ error: "year/month noto'g'ri" }, { status: 400 });
  }

  try {
    const m = await getPrayerMonth(db, city, year, month);
    return json(m, { headers: { "cache-control": "public, max-age=3600" } });
  } catch (err) {
    console.error("[prayer] all sources failed", err);
    return json({ error: "Namoz vaqtlari manbasi javob bermadi", detail: String(err) }, { status: 502 });
  }
}
