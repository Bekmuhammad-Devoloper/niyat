// Client — o'z backend'imizdagi rasmiy namoz vaqtlari (/api/prayer/monthly).
// Musulmonlar idorasi taqvimi, shahar darajasida, daqiqasigacha aniq.
// Oylik jadval bir marta yuklanib, butun oy davomida ishlatiladi.

import type { PrayerTimesResult } from "./aladhan";
import { formatGregorianUz } from "./aladhan";
import type { UzCity } from "../data/uz-cities";

export type OfficialPrayerDay = {
  day: number;
  weekday: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  hijriDay: number | null;
};

export type OfficialPrayerMonth = {
  city: string;
  cityName: string;
  region: string;
  year: number;
  month: number;
  source: string;
  fetchedAt: number;
  days: OfficialPrayerDay[];
};

export type OfficialPrayerResult = PrayerTimesResult & {
  sunrise: string;
  source: string;
  cityName: string;
  region: string;
};

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
}

export async function fetchOfficialMonth(
  city: UzCity,
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<OfficialPrayerMonth> {
  const res = await fetch(
    `${apiBase()}/api/prayer/monthly?city=${encodeURIComponent(city.slug)}&year=${year}&month=${month}`,
    { signal },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `prayer API ${res.status}`);
  }
  return (await res.json()) as OfficialPrayerMonth;
}

// Hijriy oy nomlari (o'zbekcha), 1..12
const HIJRI_MONTHS_UZ = [
  "Muharram",
  "Safar",
  "Rabi' ul-avval",
  "Rabi' us-soniy",
  "Jumad ul-avval",
  "Jumad us-soniy",
  "Rajab",
  "Sha'bon",
  "Ramazon",
  "Shavvol",
  "Zulqa'da",
  "Zulhijja",
];

// Hijriy sana: OY va YIL — Intl (Umm al-Qura) dan; KUN — rasmiy jadvaldagi
// "qamar" ustunidan (O'zbekistonda hilol kuzatuvi bo'yicha 1 kun farq
// qilishi mumkin). Oy chegarasida farqni to'g'rilaymiz.
export function officialHijri(date: Date, hijriDay: number | null): string {
  let m = 0;
  let y = 0;
  let d = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "Asia/Tashkent",
    }).formatToParts(date);
    for (const p of parts) {
      if (p.type === "day") d = Number(p.value);
      if (p.type === "month") m = Number(p.value);
      if (p.type === "year") y = Number(p.value);
    }
  } catch {
    /* Intl yo'q — pastda fallback */
  }
  if (!m || !d) {
    return hijriDay ? `${hijriDay}-kun` : "";
  }
  let day = d;
  if (hijriDay != null) {
    if (hijriDay === d || hijriDay === d - 1 || hijriDay === d + 1) {
      day = hijriDay; // bir xil oy, faqat kun farqi
    } else if (hijriDay >= 29 && d <= 2) {
      // Rasmiy taqvim hali oldingi oyda
      day = hijriDay;
      m = m === 1 ? 12 : m - 1;
      if (m === 12) y -= 1;
    } else if (hijriDay <= 2 && d >= 29) {
      // Rasmiy taqvim allaqachon keyingi oyda
      day = hijriDay;
      m = m === 12 ? 1 : m + 1;
      if (m === 1) y += 1;
    }
  }
  return `${day}-${HIJRI_MONTHS_UZ[m - 1] ?? ""}, ${y}`;
}

export function toResult(month: OfficialPrayerMonth, date: Date): OfficialPrayerResult {
  const entry = month.days.find((x) => x.day === date.getDate());
  if (!entry) throw new Error(`Jadvalda ${date.getDate()}-kun yo'q`);
  return {
    timings: {
      Fajr: entry.fajr,
      Dhuhr: entry.dhuhr,
      Asr: entry.asr,
      Maghrib: entry.maghrib,
      Isha: entry.isha,
    },
    sunrise: entry.sunrise,
    hijriReadable: officialHijri(date, entry.hijriDay),
    gregorianReadable: formatGregorianUz(date),
    source: month.source,
    cityName: month.cityName,
    region: month.region,
  };
}
