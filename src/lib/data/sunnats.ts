// Sahihi Buxoriy 1-jildning to'liq sunnat to'plami.
//
// Asosiy ma'lumotlar bazasi `public/data/bukhoriy-1.json` da saqlanadi
// (1.4 MB, 1256 ta yozuv). Bundle'ni yengil tutish uchun runtime'da
// fetch qilinadi.
//
// Bu yerda — qisqaroq tip va qulaylik funksiyalari.

export type SunnatCategory =
  | "ovqat"
  | "uyqu"
  | "namoz"
  | "muomala"
  | "tahorat"
  | "zikr"
  | "oilaviy"
  | "iymon"
  | "ilm"
  | "qur'on"
  | "haj"
  | "ro'za"
  | "boshqa";

export type Sunnat = {
  id: string;
  chapterNumber: number;
  // Sahihi Buxoriy'dagi kitob (book) bo'limi — "Iymon kitobi", "Tahorat kitobi" va h.k.
  book?: string;
  title: string;
  preview?: string;
  fullText?: string;
  // Backwards-compat eski maydonlar
  practice: string;
  context: string;
  category: SunnatCategory;
  source: string;
};

export const CATEGORY_LABELS: Record<SunnatCategory, string> = {
  iymon: "Iymon",
  ilm: "Ilm",
  tahorat: "Tahorat",
  namoz: "Namoz",
  "qur'on": "Qur'on",
  haj: "Haj",
  "ro'za": "Ro'za",
  zikr: "Zikr",
  oilaviy: "Oilaviy",
  muomala: "Muomala",
  ovqat: "Ovqat",
  uyqu: "Uyqu",
  boshqa: "Umumiy",
};

let cache: Sunnat[] | null = null;
let loadingPromise: Promise<Sunnat[]> | null = null;

export async function loadSunnats(): Promise<Sunnat[]> {
  if (cache) return cache;
  if (loadingPromise) return loadingPromise;
  loadingPromise = fetch("/data/bukhoriy-1.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load sunnats: ${r.status}`);
      return r.json() as Promise<Sunnat[]>;
    })
    .then((data) => {
      cache = data;
      loadingPromise = null;
      return data;
    });
  return loadingPromise;
}

// Sahifada hozir yuklanganlarini ko'rsatish uchun
export function getCachedSunnats(): Sunnat[] | null {
  return cache;
}

// Bugungi sunnatni qaytaradi — sana asosida deterministik.
// `pool` — yuklangan sunnatlar ro'yxati. Bo'sh bo'lsa null.
export function pickTodaySunnat(pool: Sunnat[], date: Date = new Date()): Sunnat | null {
  if (pool.length === 0) return null;
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  const dayOfYear = Math.floor(diff);
  return pool[dayOfYear % pool.length];
}

export function todayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Backwards-compat: eski "getTodaySunnat" — fallback uchun
const FALLBACK_SUNNAT: Sunnat = {
  id: "fallback",
  chapterNumber: 0,
  title: "Niyatga ko'ra amal",
  practice:
    "Barcha amallar niyatga yarasha bo'lg'usidir. Kimki hijratdan niyati dunyo topmoq ersa, dunyoga erishg'usi. Ne niyatda hijrat qilganlig'i etiborga oling'usidir.",
  context: "Umar ibn al-Xattob (r.a.) Rasululloh (s.a.v.)dan rivoyat qiladilar.",
  category: "iymon",
  source: "Sahihi Buxoriy, 1-jild, 1-bob",
};

export function getTodaySunnat(): Sunnat {
  if (!cache) return FALLBACK_SUNNAT;
  return pickTodaySunnat(cache) ?? FALLBACK_SUNNAT;
}
