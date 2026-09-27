// O'zbekiston shaharlari — rasmiy namoz vaqtlari jadvali (Musulmonlar idorasi
// taqvimi, namozvaqti.uz) shahar darajasida beriladi. Har shahar uchun:
//   slug        — namozvaqti.uz URL'idagi nom (/oylik/{oy}/{slug})
//   islomRegion — islomapi.uz viloyat nomi (zaxira manba)
//   lat/lng     — joylashuvdan eng yaqin shaharni topish uchun (taxminiy)
//
// Bu fayl ham server (handler), ham client (hook/UI) tomonida ishlatiladi —
// faqat sof ma'lumot, hech qanday import yo'q.

export type UzCity = {
  slug: string;
  name: string;
  region: string; // ko'rsatish uchun viloyat
  islomRegion: string; // islomapi.uz region nomi
  lat: number;
  lng: number;
};

export const UZ_CITIES: readonly UzCity[] = [
  // Toshkent shahri va viloyati
  { slug: "toshkent", name: "Toshkent", region: "Toshkent sh.", islomRegion: "Toshkent", lat: 41.2995, lng: 69.2401 },
  { slug: "nurafshon", name: "Nurafshon", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 41.04, lng: 69.36 },
  { slug: "angren", name: "Angren", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 41.02, lng: 70.14 },
  { slug: "olmaliq", name: "Olmaliq", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 40.85, lng: 69.6 },
  { slug: "bekobod", name: "Bekobod", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 40.22, lng: 69.27 },
  { slug: "yangiyol", name: "Yangiyo'l", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 41.11, lng: 69.05 },
  { slug: "gazalkent", name: "G'azalkent", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 41.56, lng: 69.77 },
  { slug: "parkent", name: "Parkent", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 41.29, lng: 69.68 },
  { slug: "piskent", name: "Piskent", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 40.9, lng: 69.35 },
  { slug: "boka", name: "Bo'ka", region: "Toshkent vil.", islomRegion: "Toshkent viloyati", lat: 40.81, lng: 69.2 },
  // Andijon
  { slug: "andijon", name: "Andijon", region: "Andijon", islomRegion: "Andijon", lat: 40.7821, lng: 72.3442 },
  { slug: "asaka", name: "Asaka", region: "Andijon", islomRegion: "Andijon", lat: 40.64, lng: 72.24 },
  { slug: "xonobod", name: "Xonobod", region: "Andijon", islomRegion: "Andijon", lat: 40.81, lng: 72.97 },
  { slug: "shahrixon", name: "Shahrixon", region: "Andijon", islomRegion: "Andijon", lat: 40.71, lng: 72.05 },
  { slug: "marhamat", name: "Marhamat", region: "Andijon", islomRegion: "Andijon", lat: 40.49, lng: 72.32 },
  { slug: "paxtaobod", name: "Paxtaobod", region: "Andijon", islomRegion: "Andijon", lat: 40.94, lng: 72.49 },
  { slug: "xojaobod", name: "Xo'jaobod", region: "Andijon", islomRegion: "Andijon", lat: 40.67, lng: 72.56 },
  // Namangan
  { slug: "namangan", name: "Namangan", region: "Namangan", islomRegion: "Namangan", lat: 40.9983, lng: 71.6726 },
  { slug: "chust", name: "Chust", region: "Namangan", islomRegion: "Namangan", lat: 41.0, lng: 71.24 },
  { slug: "chortoq", name: "Chortoq", region: "Namangan", islomRegion: "Namangan", lat: 41.07, lng: 71.82 },
  { slug: "pop1", name: "Pop", region: "Namangan", islomRegion: "Namangan", lat: 40.87, lng: 71.11 },
  { slug: "uchqorgon", name: "Uchqo'rg'on", region: "Namangan", islomRegion: "Namangan", lat: 41.11, lng: 72.08 },
  // Farg'ona
  { slug: "fargona", name: "Farg'ona", region: "Farg'ona", islomRegion: "Farg'ona", lat: 40.3863, lng: 71.7868 },
  { slug: "margilon", name: "Marg'ilon", region: "Farg'ona", islomRegion: "Farg'ona", lat: 40.47, lng: 71.72 },
  { slug: "qoqon", name: "Qo'qon", region: "Farg'ona", islomRegion: "Farg'ona", lat: 40.53, lng: 70.94 },
  { slug: "quva", name: "Quva", region: "Farg'ona", islomRegion: "Farg'ona", lat: 40.52, lng: 72.07 },
  { slug: "rishton", name: "Rishton", region: "Farg'ona", islomRegion: "Farg'ona", lat: 40.36, lng: 71.28 },
  { slug: "oltiariq", name: "Oltiariq", region: "Farg'ona", islomRegion: "Farg'ona", lat: 40.39, lng: 71.48 },
  { slug: "bogdod", name: "Bog'dod", region: "Farg'ona", islomRegion: "Farg'ona", lat: 40.47, lng: 71.32 },
  // Buxoro
  { slug: "buxoro", name: "Buxoro", region: "Buxoro", islomRegion: "Buxoro", lat: 39.7681, lng: 64.4556 },
  { slug: "gijduvon", name: "G'ijduvon", region: "Buxoro", islomRegion: "Buxoro", lat: 40.1, lng: 64.68 },
  { slug: "qorakol", name: "Qorako'l", region: "Buxoro", islomRegion: "Buxoro", lat: 39.5, lng: 63.85 },
  { slug: "gazli", name: "Gazli", region: "Buxoro", islomRegion: "Buxoro", lat: 40.13, lng: 63.45 },
  { slug: "jondor", name: "Jondor", region: "Buxoro", islomRegion: "Buxoro", lat: 39.72, lng: 64.19 },
  // Samarqand
  { slug: "samarqand", name: "Samarqand", region: "Samarqand", islomRegion: "Samarqand", lat: 39.6542, lng: 66.9597 },
  { slug: "kattaqorgon", name: "Kattaqo'rg'on", region: "Samarqand", islomRegion: "Samarqand", lat: 39.9, lng: 66.26 },
  { slug: "urgut", name: "Urgut", region: "Samarqand", islomRegion: "Samarqand", lat: 39.4, lng: 67.24 },
  { slug: "ishtixon", name: "Ishtixon", region: "Samarqand", islomRegion: "Samarqand", lat: 39.97, lng: 66.49 },
  // Jizzax
  { slug: "jizzax", name: "Jizzax", region: "Jizzax", islomRegion: "Jizzax", lat: 40.1158, lng: 67.842 },
  { slug: "zomin", name: "Zomin", region: "Jizzax", islomRegion: "Jizzax", lat: 39.96, lng: 68.4 },
  { slug: "gallaorol", name: "G'allaorol", region: "Jizzax", islomRegion: "Jizzax", lat: 40.03, lng: 67.6 },
  { slug: "dostlik", name: "Do'stlik", region: "Jizzax", islomRegion: "Jizzax", lat: 40.52, lng: 68.04 },
  // Navoiy
  { slug: "navoiy", name: "Navoiy", region: "Navoiy", islomRegion: "Navoiy", lat: 40.0844, lng: 65.3792 },
  { slug: "zarafshon", name: "Zarafshon", region: "Navoiy", islomRegion: "Navoiy", lat: 41.58, lng: 64.2 },
  { slug: "nurota", name: "Nurota", region: "Navoiy", islomRegion: "Navoiy", lat: 40.56, lng: 65.69 },
  { slug: "uchquduq", name: "Uchquduq", region: "Navoiy", islomRegion: "Navoiy", lat: 42.16, lng: 63.56 },
  { slug: "konimex", name: "Konimex", region: "Navoiy", islomRegion: "Navoiy", lat: 40.27, lng: 65.02 },
  // Qashqadaryo
  { slug: "qarshi", name: "Qarshi", region: "Qashqadaryo", islomRegion: "Qashqadaryo", lat: 38.8597, lng: 65.789 },
  { slug: "shahrisabz", name: "Shahrisabz", region: "Qashqadaryo", islomRegion: "Qashqadaryo", lat: 39.06, lng: 66.83 },
  { slug: "guzor", name: "G'uzor", region: "Qashqadaryo", islomRegion: "Qashqadaryo", lat: 38.62, lng: 66.25 },
  { slug: "muborak", name: "Muborak", region: "Qashqadaryo", islomRegion: "Qashqadaryo", lat: 39.25, lng: 65.15 },
  { slug: "dehqonobod", name: "Dehqonobod", region: "Qashqadaryo", islomRegion: "Qashqadaryo", lat: 38.35, lng: 66.51 },
  // Surxondaryo
  { slug: "termiz", name: "Termiz", region: "Surxondaryo", islomRegion: "Surxondaryo", lat: 37.2242, lng: 67.2783 },
  { slug: "denov", name: "Denov", region: "Surxondaryo", islomRegion: "Surxondaryo", lat: 38.27, lng: 67.89 },
  { slug: "boysun", name: "Boysun", region: "Surxondaryo", islomRegion: "Surxondaryo", lat: 38.21, lng: 67.2 },
  { slug: "sherobod", name: "Sherobod", region: "Surxondaryo", islomRegion: "Surxondaryo", lat: 37.66, lng: 67.0 },
  { slug: "shorchi", name: "Sho'rchi", region: "Surxondaryo", islomRegion: "Surxondaryo", lat: 37.99, lng: 67.79 },
  // Xorazm
  { slug: "urganch", name: "Urganch", region: "Xorazm", islomRegion: "Xorazm", lat: 41.5505, lng: 60.6317 },
  { slug: "xiva", name: "Xiva", region: "Xorazm", islomRegion: "Xorazm", lat: 41.38, lng: 60.36 },
  { slug: "hazorasp", name: "Hazorasp", region: "Xorazm", islomRegion: "Xorazm", lat: 41.32, lng: 61.07 },
  { slug: "xonqa", name: "Xonqa", region: "Xorazm", islomRegion: "Xorazm", lat: 41.47, lng: 60.8 },
  { slug: "shovot", name: "Shovot", region: "Xorazm", islomRegion: "Xorazm", lat: 41.66, lng: 60.31 },
  // Qoraqalpog'iston
  { slug: "nukus", name: "Nukus", region: "Qoraqalpog'iston", islomRegion: "Qoraqalpog'iston", lat: 42.4731, lng: 59.6103 },
  { slug: "qongirot", name: "Qo'ng'irot", region: "Qoraqalpog'iston", islomRegion: "Qoraqalpog'iston", lat: 43.05, lng: 58.85 },
  { slug: "moynoq", name: "Mo'ynoq", region: "Qoraqalpog'iston", islomRegion: "Qoraqalpog'iston", lat: 43.77, lng: 59.02 },
  { slug: "tortkol", name: "To'rtko'l", region: "Qoraqalpog'iston", islomRegion: "Qoraqalpog'iston", lat: 41.55, lng: 61.0 },
  { slug: "taxtakopir", name: "Taxtako'pir", region: "Qoraqalpog'iston", islomRegion: "Qoraqalpog'iston", lat: 43.03, lng: 60.32 },
  // Sirdaryo
  { slug: "guliston", name: "Guliston", region: "Sirdaryo", islomRegion: "Sirdaryo", lat: 40.4897, lng: 68.7842 },
  { slug: "sirdaryo", name: "Sirdaryo", region: "Sirdaryo", islomRegion: "Sirdaryo", lat: 40.84, lng: 68.66 },
] as const;

export const DEFAULT_CITY_SLUG = "toshkent";

export function findCity(slug: string | null | undefined): UzCity | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  return UZ_CITIES.find((c) => c.slug === s) ?? null;
}

// Eski sozlama qiymatlari (islomapi.uz viloyat nomi, masalan "Toshkent",
// "Farg'ona", "Qashqadaryo") → shahar slug'i. Yangi qiymatlar allaqachon slug.
export function cityFromLegacyRegion(value: string | null | undefined): UzCity | null {
  if (!value) return null;
  const direct = findCity(value);
  if (direct) return direct;
  const byRegion = UZ_CITIES.find((c) => c.islomRegion === value);
  return byRegion ?? null;
}

// Koordinatalardan eng yaqin shahar (tekislik yaqinlashuvi — O'zbekiston
// masshtabida yetarli; lng farqini kenglik kosinusiga ko'paytiramiz).
export function nearestCity(lat: number, lng: number): UzCity {
  let best: UzCity = UZ_CITIES[0];
  let bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const c of UZ_CITIES) {
    const dLat = c.lat - lat;
    const dLng = (c.lng - lng) * k;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
