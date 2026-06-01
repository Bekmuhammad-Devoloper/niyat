// Aladhan API klienti — namoz vaqtlari + hijriy/gregorian sana.
// Docs: https://aladhan.com/prayer-times-api
//
// Default joylashuv: Toshkent (41.2995, 69.2401), Hanafiy madhhab,
// usul 1 — University of Islamic Sciences, Karachi.

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type PrayerTimings = Record<PrayerName, string>;

export type AladhanResponse = {
  code: number;
  status: string;
  data: {
    timings: Record<string, string>;
    date: {
      readable: string;
      hijri: {
        date: string; // "DD-MM-YYYY"
        day: string;
        month: { number: number; en: string; ar: string };
        year: string;
      };
      gregorian: {
        date: string; // "DD-MM-YYYY"
        day: string;
        month: { number: number; en: string };
        year: string;
        weekday?: { en: string };
      };
    };
  };
};

export type PrayerTimesResult = {
  timings: PrayerTimings;
  hijriReadable: string; // O'zbekcha: "10 Zulhijja 1447"
  gregorianReadable: string; // O'zbekcha: "19 may 2026"
};

export type FetchPrayerOptions = {
  latitude?: number;
  longitude?: number;
  method?: number;
  school?: 0 | 1;
  date?: Date;
  signal?: AbortSignal;
};

const DEFAULTS = {
  latitude: 41.2995,
  longitude: 69.2401,
  method: 1,
  school: 1 as const,
};

// Hijriy oy nomlari o'zbek tilida (1-12)
const HIJRI_MONTHS_UZ: Record<number, string> = {
  1: "Muharram",
  2: "Safar",
  3: "Rabi' ul-avval",
  4: "Rabi' us-soniy",
  5: "Jumadi ul-avval",
  6: "Jumadi us-soniy",
  7: "Rajab",
  8: "Sha'bon",
  9: "Ramazon",
  10: "Shavvol",
  11: "Zulqa'da",
  12: "Zulhijja",
};

// Milodiy oy nomlari o'zbek tilida (1-12)
const GREGORIAN_MONTHS_UZ: Record<number, string> = {
  1: "yanvar",
  2: "fevral",
  3: "mart",
  4: "aprel",
  5: "may",
  6: "iyun",
  7: "iyul",
  8: "avgust",
  9: "sentyabr",
  10: "oktyabr",
  11: "noyabr",
  12: "dekabr",
};

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function clean(time: string): string {
  return time.split(" ")[0] ?? time;
}

export function formatHijriUz(
  day: string | number,
  monthNumber: number,
  year: string | number,
): string {
  const d = typeof day === "string" ? parseInt(day, 10) : day;
  const monthName = HIJRI_MONTHS_UZ[monthNumber] ?? `Oy ${monthNumber}`;
  return `${d}-${monthName}, ${year}`;
}

export function formatGregorianUz(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${d}-${GREGORIAN_MONTHS_UZ[m]}, ${y}`;
}

export async function fetchPrayerTimes(
  options: FetchPrayerOptions = {},
): Promise<PrayerTimesResult> {
  const {
    latitude = DEFAULTS.latitude,
    longitude = DEFAULTS.longitude,
    method = DEFAULTS.method,
    school = DEFAULTS.school,
    date = new Date(),
    signal,
  } = options;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    method: String(method),
    school: String(school),
  });
  const url = `https://api.aladhan.com/v1/timings/${formatDate(date)}?${params}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Aladhan API ${res.status}: ${res.statusText}`);
  }
  const body = (await res.json()) as AladhanResponse;
  if (body.code !== 200) {
    throw new Error(`Aladhan returned status ${body.code}: ${body.status}`);
  }

  const t = body.data.timings;
  const hijri = body.data.date.hijri;

  return {
    timings: {
      Fajr: clean(t.Fajr),
      Dhuhr: clean(t.Dhuhr),
      Asr: clean(t.Asr),
      Maghrib: clean(t.Maghrib),
      Isha: clean(t.Isha),
    },
    hijriReadable: formatHijriUz(hijri.day, hijri.month.number, hijri.year),
    gregorianReadable: formatGregorianUz(date),
  };
}
