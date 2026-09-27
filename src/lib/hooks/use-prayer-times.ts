import { useQuery } from "@tanstack/react-query";
import { fetchPrayerTimes, type PrayerName, type PrayerTimesResult } from "@/lib/api/aladhan";
import { fetchOfficialMonth, toResult } from "@/lib/api/prayer-api";
import {
  cityFromLegacyRegion,
  findCity,
  nearestCity,
  DEFAULT_CITY_SLUG,
  type UzCity,
} from "@/lib/data/uz-cities";
import type { Prayer } from "@/lib/niyat-data";
import { useSettings } from "./use-settings";

const PRAYER_LABELS_UZ: Record<PrayerName, string> = {
  Fajr: "Bomdod",
  Dhuhr: "Peshin",
  Asr: "Asr",
  Maghrib: "Shom",
  Isha: "Xufton",
};

const PRAYER_ORDER: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

function parseHMM(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// Joriy vaqt asosida qaysi namoz "done", "now", "next" ekanligini hisoblaydi.
// "now" — oxirgi vaqti kirgan namoz (keyingisi kelguncha).
function toPrayerList(result: PrayerTimesResult, now: Date = new Date()): Prayer[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const entries = PRAYER_ORDER.map((name) => ({
    name,
    time: result.timings[name],
    minutes: parseHMM(result.timings[name]),
  }));

  let nowIndex = -1;
  for (let i = 0; i < entries.length; i++) {
    if (nowMin >= entries[i].minutes) nowIndex = i;
    else break;
  }

  return entries.map((e, i) => ({
    id: e.name.toLowerCase(),
    name: PRAYER_LABELS_UZ[e.name],
    time: e.time,
    state: i < nowIndex ? "done" : i === nowIndex ? "now" : "next",
  }));
}

export type UsePrayerTimesOptions = {
  latitude?: number;
  longitude?: number;
};

// Sozlama + joylashuvdan shaharni aniqlash:
//   - prayerRegion = shahar slug'i ("samarqand") yoki eski viloyat nomi ("Toshkent")
//   - bo'sh ("") = AVTO: joylashuv bo'yicha eng yaqin shahar; joylashuv yo'q — Toshkent
export function resolvePrayerCity(
  prayerRegion: string | undefined,
  latitude?: number,
  longitude?: number,
): { city: UzCity; auto: boolean } {
  const chosen = findCity(prayerRegion) ?? cityFromLegacyRegion(prayerRegion);
  if (chosen) return { city: chosen, auto: false };
  if (latitude != null && longitude != null) {
    return { city: nearestCity(latitude, longitude), auto: true };
  }
  return { city: findCity(DEFAULT_CITY_SLUG)!, auto: true };
}

export function usePrayerTimes(options: UsePrayerTimesOptions = {}) {
  const { settings } = useSettings();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const dateKey = `${year}-${month}-${today.getDate()}`;

  const latitude = options.latitude ?? settings.location?.latitude;
  const longitude = options.longitude ?? settings.location?.longitude;
  const school = settings.madhhab === "hanafi" ? 1 : 0;
  const method = settings.calculationMethod;

  const { city, auto } = resolvePrayerCity(settings.prayerRegion, latitude, longitude);

  // Rasmiy oylik jadval — bir marta yuklanadi, oy davomida keshda turadi.
  const official = useQuery({
    queryKey: ["prayer-official", city.slug, year, month],
    queryFn: ({ signal }) => fetchOfficialMonth(city, year, month, signal),
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24 * 2,
    retry: 2,
  });

  // Ertangi kun keyingi oyda bo'lsa (oy oxiri) — keyingi oy jadvalini ham
  // oldindan yuklaymiz: Xuftondan keyin "Keyingi namoz" ERTANGI Bomdod bo'lishi
  // kerak (bugungi Bomdod bilan 1 daqiqa farq qilishi mumkin).
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowInNextMonth = tomorrow.getMonth() !== today.getMonth();
  const nextMonthDate = tomorrowInNextMonth ? tomorrow : null;
  const officialNext = useQuery({
    queryKey: [
      "prayer-official",
      city.slug,
      nextMonthDate?.getFullYear() ?? year,
      (nextMonthDate?.getMonth() ?? 0) + 1,
    ],
    queryFn: ({ signal }) =>
      fetchOfficialMonth(city, nextMonthDate!.getFullYear(), nextMonthDate!.getMonth() + 1, signal),
    enabled: tomorrowInNextMonth,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24 * 2,
    retry: 2,
  });

  // Zaxira — Aladhan (hisoblangan). Faqat rasmiy manba XATO bergandagina.
  const fallback = useQuery({
    queryKey: ["prayer-aladhan", dateKey, latitude, longitude, school, method],
    queryFn: ({ signal }) =>
      fetchPrayerTimes({ latitude, longitude, school, method, date: today, signal }),
    enabled: official.isError,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  let data: PrayerTimesResult | null = null;
  let sunrise: string | null = null;
  let source: "official" | "aladhan" | null = null;
  if (official.data) {
    try {
      const r = toResult(official.data, today);
      data = r;
      sunrise = r.sunrise;
      source = "official";
    } catch (err) {
      console.warn("[prayer-times] rasmiy jadvalda bugungi kun yo'q", err);
    }
  }
  if (!data && fallback.data) {
    data = fallback.data;
    source = "aladhan";
  }

  const prayers = data ? toPrayerList(data) : null;
  let nextPrayer = prayers?.find((p) => p.state === "next") ?? null;
  const currentPrayer = prayers?.find((p) => p.state === "now") ?? null;

  // Bugungi barcha namozlar o'tgan (Xuftondan keyin) — keyingisi ERTANGI Bomdod.
  // Rasmiy jadvaldan ertangi kunning aniq vaqtini olamiz.
  if (prayers && !nextPrayer) {
    const monthData = tomorrowInNextMonth ? officialNext.data : official.data;
    const entry = monthData?.days.find((d) => d.day === tomorrow.getDate());
    nextPrayer = {
      id: "fajr",
      name: PRAYER_LABELS_UZ.Fajr,
      time: entry?.fajr ?? prayers[0].time,
      state: "next",
    };
  }

  const isLoading = official.isLoading || (official.isError && fallback.isLoading);
  const isError = official.isError && fallback.isError;

  return {
    data,
    isLoading,
    isError,
    error: official.error ?? fallback.error ?? null,
    refetch: official.refetch,
    prayers,
    nextPrayer,
    currentPrayer,
    sunrise,
    source,
    city,
    cityAuto: auto,
    hijriReadable: data?.hijriReadable ?? null,
    gregorianReadable: data?.gregorianReadable ?? null,
  };
}

// Hozir vaqtdan keyingi namozgacha qancha qolganini "X soat Y daqiqa" formatida qaytaradi.
export function formatCountdown(toTimeHMM: string, now: Date = new Date()): string {
  const target = parseHMM(toTimeHMM);
  const cur = now.getHours() * 60 + now.getMinutes();
  let diff = target - cur;
  if (diff < 0) diff += 24 * 60; // ertangi kun bo'lsa
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} daqiqada`;
  if (m === 0) return `${h} soatda`;
  return `${h} soat ${m} daqiqada`;
}
