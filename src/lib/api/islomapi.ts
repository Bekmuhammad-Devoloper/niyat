// Rasmiy islom.uz dan keladigan namoz vaqtlari API'si.
// Manba: https://islomapi.uz (ma'lumotlar islom.uz dan olinadi)
// CORS ruxsat etilgan (Access-Control-Allow-Origin: *), brauzerdan to'g'ridan
// to'g'ri chaqirsa bo'ladi.
//
// Endpoint: GET https://islomapi.uz/api/monthly?region={Toshkent}&month={1..12}
// Javob — oy davomidagi har bir kun uchun obyektlar massivi.

import type { PrayerName, PrayerTimings, PrayerTimesResult } from "./aladhan";
import { formatGregorianUz } from "./aladhan";

// O'zbekistondagi viloyatlar — islom.uz API ham aynan shu nomlarni qabul qiladi
export const ISLOMUZ_REGIONS = [
  "Toshkent",
  "Toshkent viloyati",
  "Andijon",
  "Buxoro",
  "Farg'ona",
  "Jizzax",
  "Namangan",
  "Navoiy",
  "Qashqadaryo",
  "Qoraqalpog'iston",
  "Samarqand",
  "Sirdaryo",
  "Surxondaryo",
  "Xorazm",
] as const;

export type IslomUzRegion = (typeof ISLOMUZ_REGIONS)[number];

type IslomUzDay = {
  region: string;
  regionNumber: number;
  month: number;
  day: number;
  date: string;
  hijri_date: { month: string; day: number };
  weekday: string;
  times: {
    tong_saharlik: string; // Fajr (Bomdod) — tong saharlik vaqti
    quyosh: string; // Quyosh chiqishi (Sunrise)
    peshin: string; // Dhuhr (Peshin)
    asr: string; // Asr
    shom_iftor: string; // Maghrib (Shom)
    hufton: string; // Isha (Xufton)
  };
};

const API_BASE = "https://islomapi.uz";

// Hijriy oy nomlarini o'zbekcha formatga keltirish (API "zulhijja / muharram"
// kabi qaytaradi — biz birinchisini olamiz).
function formatHijriFromApi(hijri: { month: string; day: number }): string {
  const month = hijri.month.split("/")[0]?.trim() ?? hijri.month;
  // Birinchi harf katta
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${hijri.day}-${monthCap}`;
}

export async function fetchPrayerTimesIslomUz(opts: {
  region?: IslomUzRegion | string;
  date?: Date;
  signal?: AbortSignal;
}): Promise<PrayerTimesResult> {
  const {
    region = "Toshkent",
    date = new Date(),
    signal,
  } = opts;

  const month = date.getMonth() + 1; // 1..12
  const day = date.getDate(); // 1..31

  const url = `${API_BASE}/api/monthly?region=${encodeURIComponent(region)}&month=${month}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`islomapi.uz ${res.status}: ${res.statusText}`);
  }

  const list = (await res.json()) as IslomUzDay[];
  if (!Array.isArray(list)) {
    throw new Error("islomapi.uz: kutilmagan javob formati");
  }

  // Bugungi kun bo'yicha topamiz (yil hisobga olinmaydi — API odatda joriy
  // taqvim yilini qaytaradi, yil ba'zan eski bo'lishi mumkin)
  const todayEntry = list.find((d) => d.day === day);
  if (!todayEntry) {
    throw new Error(`islomapi.uz: ${day}-kun topilmadi`);
  }

  const t = todayEntry.times;
  const timings: PrayerTimings = {
    Fajr: t.tong_saharlik,
    Dhuhr: t.peshin,
    Asr: t.asr,
    Maghrib: t.shom_iftor,
    Isha: t.hufton,
  };

  return {
    timings,
    hijriReadable: formatHijriFromApi(todayEntry.hijri_date),
    gregorianReadable: formatGregorianUz(date),
  };
}

// Joylashuv koordinatalaridan O'zbekiston viloyatini taxminiy aniqlash.
// Aniqlik darajasi past — viloyat poytaxti markaziga eng yaqin region.
// Foydalanuvchi sozlamalardan aniq region tanlashi mumkin.
const REGION_CENTERS: { name: IslomUzRegion; lat: number; lng: number }[] = [
  { name: "Toshkent", lat: 41.2995, lng: 69.2401 },
  { name: "Toshkent viloyati", lat: 41.3556, lng: 69.7686 },
  { name: "Andijon", lat: 40.7821, lng: 72.3442 },
  { name: "Buxoro", lat: 39.7681, lng: 64.4556 },
  { name: "Farg'ona", lat: 40.3863, lng: 71.7868 },
  { name: "Jizzax", lat: 40.1158, lng: 67.842 },
  { name: "Namangan", lat: 40.9983, lng: 71.6726 },
  { name: "Navoiy", lat: 40.0844, lng: 65.3792 },
  { name: "Qashqadaryo", lat: 38.8597, lng: 65.789 }, // Qarshi
  { name: "Qoraqalpog'iston", lat: 42.4731, lng: 59.6103 }, // Nukus
  { name: "Samarqand", lat: 39.6542, lng: 66.9597 },
  { name: "Sirdaryo", lat: 40.3782, lng: 68.7188 }, // Guliston
  { name: "Surxondaryo", lat: 37.2242, lng: 67.2783 }, // Termiz
  { name: "Xorazm", lat: 41.5505, lng: 60.6317 }, // Urganch
];

export function nearestRegion(
  lat: number,
  lng: number,
): IslomUzRegion {
  let best: IslomUzRegion = "Toshkent";
  let bestDist = Infinity;
  for (const r of REGION_CENTERS) {
    const dLat = r.lat - lat;
    const dLng = r.lng - lng;
    const dist = dLat * dLat + dLng * dLng; // Yetarlicha (proportsional)
    if (dist < bestDist) {
      bestDist = dist;
      best = r.name;
    }
  }
  return best;
}

// Backwards-compat — eski PrayerName tipini saqlaymiz (Fajr, Dhuhr, ...).
export type { PrayerName, PrayerTimings, PrayerTimesResult };
