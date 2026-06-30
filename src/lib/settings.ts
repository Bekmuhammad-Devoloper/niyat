// Markazlashgan ilova sozlamalari — `niyat:settings` keyida localStorage'da
// saqlanadi. Hammasi bir joyda bo'lib, kelajakda backend'ga sync qilish oson.

export type AIPersonalityKey =
  | "balanced"
  | "strict_father"
  | "kind_mother"
  | "drill_sergeant"
  | "friend"
  | "sport_coach";

export type AIPersonality = {
  key: AIPersonalityKey;
  label: string;
  description: string;
  systemSuffix: string; // System prompt'ga qo'shiladi
};

export const AI_PERSONALITIES: AIPersonality[] = [
  {
    key: "balanced",
    label: "Muvozanatli",
    description: "Standart ohang — mehribon, lekin to'g'ri so'zli",
    systemSuffix: "",
  },
  {
    key: "strict_father",
    label: "Qattiqqo'l ota",
    description: "Sevgini ko'rsatish o'rniga, talab qiladi",
    systemSuffix:
      "\n\nSening ohang: qattiqqo'l ota. Sevgi ko'rsatma — talab qil. Maqtov kam, dakki tez. Foydalanuvchini katta bo'lishga undash kerak. 'Sen bola emassan' uslubi.",
  },
  {
    key: "kind_mother",
    label: "Mehribon ona",
    description: "Sabrli, isitma, lekin chuqur",
    systemSuffix:
      "\n\nSening ohang: mehribon ona. Iliq, sabrli, lekin yumshoq emas. Yuragiga yo'l topib gapir. 'Mening bolam' kabi muloqot. Kuchli his bilan, lekin haqiqatni yashirma.",
  },
  {
    key: "drill_sergeant",
    label: "Harbiy serjant",
    description: "Qisqa, keskin, intizomli",
    systemSuffix:
      "\n\nSening ohang: harbiy serjant. Buyruq beradigan, qisqa jumlalar, hech qanday lirik chekinish yo'q. Vaqt yo'q. Maqsad — bajar. Bahona yo'q.",
  },
  {
    key: "friend",
    label: "Yaqin do'st",
    description: "Tengma-teng, oddiy, tushunadigan",
    systemSuffix:
      "\n\nSening ohang: yaqin do'st. Tengma-teng, oddiy ko'cha tilida (lekin uyatli emas). Foydalanuvchining tomonida turasan. Maslahat berasan, lekin xukm qilmaysan.",
  },
  {
    key: "sport_coach",
    label: "Sport murabbiyi",
    description: "Energiyali, natijaga yo'naltirilgan",
    systemSuffix:
      "\n\nSening ohang: sport murabbiyi. Energiyali, raqamlarga qiziqasan, har gapda 'PR' (personal record) izlaysan. Maqsad, ko'rsatkich, takror, intizom. Yutib chiqishga undaysan.",
  },
];

export type Madhhab = "hanafi" | "shafii";

export type PrayerCalculationMethod = number; // Aladhan method ID

export type NotificationSettings = {
  prayerReminders: boolean;
  reminderMinutes: number; // namozdan necha daqiqa oldin
  dailyNiyat: boolean;
  niyatHour: number; // 0-23
  motherCallReminder: boolean;
  dailySunnat: boolean;
  sunnatHour: number; // 0-23
  // Bajarilmagan niyatlar uchun davriy eslatma (kun davomida)
  niyatPersistReminders: boolean;
  niyatPersistHours: number; // har necha soatda
  // Juma kuni eng yaqin masjid eslatmasi
  fridayMosqueReminder: boolean;
  fridayMosqueHour: number; // 0-23, default 12 (juma namozidan oldin)
  // Azon — namoz vaqtidan N daqiqa oldin avtomatik chaqiriladi.
  // Ilova ochiq bo'lsa, audio loop bo'lib aytaveradi (siz to'xtatmaguncha).
  adhanEnabled: boolean;
  adhanUrl: string;
  adhanLeadMinutes: number;
  // Reja vaqti kelganda notification chiqsin; agar X daqiqada "Bajardim"
  // bosilmasa, ayol ovozida iliq eslatma TTS o'qib bersin.
  goalVoiceReminderEnabled: boolean;
  goalVoiceReminderDelayMinutes: number; // default 2
};

export type VoiceSettings = {
  ttsEnabled: boolean;
  ttsRate: number; // 0.5-2.0
  ttsPitch: number; // 0-2
  preferredLang: string; // BCP 47 (uz-UZ, ru-RU, en-US)
  // Coach ekrani ochiq turganda mikrofon doimiy yoniq tursin — gapirish
  // tugaganda avtomatik yuborsin, qayta tinglashga otsin (Siri kabi).
  micAlwaysOn: boolean;
  // APK'da: ilova yopiq paytda ham mikrofon eshitib tursin (foreground service).
  // Bildirishnoma doimiy chiqib turadi ("Niyat — mikrofon yoqilgan").
  micBackground: boolean;
  // "Niyat" deyish bilan ovozli muloqot rejimini avtomatik ochish (wake word).
  // Talab: micBackground yoqilgan bo'lishi kerak (Android'da 24/7 eshitish uchun).
  wakeWordEnabled: boolean;
};

export type Settings = {
  aiPersonality: AIPersonalityKey;
  madhhab: Madhhab;
  calculationMethod: PrayerCalculationMethod;
  // O'zbekiston viloyati — islom.uz API uchun. Bo'sh bo'lsa, joylashuvdan
  // eng yaqin viloyat avtomatik aniqlanadi.
  prayerRegion: string;
  location: { latitude: number; longitude: number; label: string } | null;
  notifications: NotificationSettings;
  voice: VoiceSettings;
};

export const DEFAULT_SETTINGS: Settings = {
  aiPersonality: "balanced",
  madhhab: "hanafi",
  calculationMethod: 1, // University of Islamic Sciences, Karachi
  prayerRegion: "Toshkent", // islom.uz API uchun default viloyat
  location: null, // Aladhan'ga uzatilmasa, Toshkent default
  notifications: {
    prayerReminders: false,
    reminderMinutes: 10,
    dailyNiyat: false,
    niyatHour: 6,
    motherCallReminder: false,
    dailySunnat: false,
    sunnatHour: 7,
    niyatPersistReminders: true, // default yoqilgan
    niyatPersistHours: 3,
    fridayMosqueReminder: true, // default yoqilgan — juma namozi muhim
    fridayMosqueHour: 12,
    adhanEnabled: true, // default yoqilgan
    adhanUrl: "",
    adhanLeadMinutes: 0, // 0 = aynan namoz vaqtida (bir marta)
    goalVoiceReminderEnabled: true, // default yoqilgan
    goalVoiceReminderDelayMinutes: 2,
  },
  voice: {
    ttsEnabled: false,
    ttsRate: 1.0,
    ttsPitch: 1.0,
    preferredLang: "uz-UZ",
    micAlwaysOn: false, // default: o'chiq — foydalanuvchi Coach'da xohlasa yoqadi
    micBackground: false, // default: o'chiq — Sozlamalar → Ovoz orqali yoqiladi
    // default: o'chirilgan — BackgroundMic foreground service mikrofonni
    // doimiy egallab oladi va voice mode ochilganda "Could not start audio
    // source" xatosi keladi. Foydalanuvchi xohlasa sozlamalarda yoqadi —
    // sozlamalar UI'da "voice mode bilan birga ishlamasligi mumkin"
    // ogohlantirishi bor.
    wakeWordEnabled: false,
  },
};

export function getPersonality(key: AIPersonalityKey): AIPersonality {
  return AI_PERSONALITIES.find((p) => p.key === key) ?? AI_PERSONALITIES[0];
}
