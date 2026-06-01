// Matn yordamchi funksiyalari.

// Birinchi harfni katta qiladi — o'zbek tilida ham to'g'ri ishlaydi.
// (i → I, g → G, h → H, va h.k.)
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("uz") + s.slice(1);
}

// onChange'da live capitalize uchun qulay wrapper:
// <input onChange={(e) => setX(autoCapitalize(e.target.value))} />
export function autoCapitalize(value: string): string {
  return capitalizeFirst(value);
}

// BCP-47 til kodidan bayroq emojisini qaytaradi (uz-UZ → 🇺🇿).
const LANG_FLAGS: Record<string, string> = {
  "uz-UZ": "🇺🇿",
  uz: "🇺🇿",
  "ru-RU": "🇷🇺",
  ru: "🇷🇺",
  "en-US": "🇺🇸",
  "en-GB": "🇬🇧",
  en: "🇺🇸",
  "tr-TR": "🇹🇷",
  tr: "🇹🇷",
  "ar-SA": "🇸🇦",
  ar: "🇸🇦",
};

export function langFlag(code: string): string {
  return LANG_FLAGS[code] ?? LANG_FLAGS[code.slice(0, 2)] ?? "🌐";
}
