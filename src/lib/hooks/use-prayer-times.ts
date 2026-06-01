import { useQuery } from "@tanstack/react-query";
import { fetchPrayerTimes, type PrayerName, type PrayerTimesResult } from "@/lib/api/aladhan";
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
// "now" — eng yaqin keladigan (yoki o'tib ketgan, lekin keyingisi hali kelmagan) namoz.
function toPrayerList(result: PrayerTimesResult, now: Date = new Date()): Prayer[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const entries = PRAYER_ORDER.map((name) => ({
    name,
    time: result.timings[name],
    minutes: parseHMM(result.timings[name]),
  }));

  // Joriy paytda qaysi namoz "now" deb hisoblanadi:
  // oxirgi vaqti o'tgan namozni "now" deb belgilaymiz — keyingisi kelguncha.
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

export function usePrayerTimes(options: UsePrayerTimesOptions = {}) {
  const { settings } = useSettings();
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Settings'dan joylashuv va madhhab/method'ni olamiz.
  const latitude = options.latitude ?? settings.location?.latitude;
  const longitude = options.longitude ?? settings.location?.longitude;
  const school = settings.madhhab === "hanafi" ? 1 : 0;
  const method = settings.calculationMethod;

  const query = useQuery({
    queryKey: ["prayer-times", dateKey, latitude, longitude, school, method],
    queryFn: ({ signal }) =>
      fetchPrayerTimes({
        latitude,
        longitude,
        school,
        method,
        date: today,
        signal,
      }),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
    retry: 1,
  });

  const prayers = query.data ? toPrayerList(query.data) : null;
  const nextPrayer = prayers?.find((p) => p.state === "next") ?? null;
  const currentPrayer = prayers?.find((p) => p.state === "now") ?? null;

  return {
    ...query,
    prayers,
    nextPrayer,
    currentPrayer,
    hijriReadable: query.data?.hijriReadable ?? null,
    gregorianReadable: query.data?.gregorianReadable ?? null,
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
