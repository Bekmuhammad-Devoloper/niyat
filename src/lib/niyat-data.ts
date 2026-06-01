// Niyat ilovasi uchun markazlashgan ma'lumot qatlami.
// MVP'da bu fayl mock data saqlaydi. Backend integratsiyasi bo'lganda
// bu fayl o'rniga TanStack Query hooks (useGoals, usePrayers, ...) ishlatiladi.

export type Prayer = {
  id: string;
  name: string;
  time: string;
  state: "done" | "now" | "next";
};

// Maqsadlar uchun takrorlanish turi. Daily/weekly/monthly scope'larida
// turli variantlar ishlatiladi:
// - daily:              har kuni bajariladi
// - count:              haftada N marta (istalgan kunda)
// - specific:           hafta aniq kunlarida (0=Yak, 1=Du, ..., 6=Sh)
// - monthly_count:      oyda N marta (istalgan sanada)
// - monthly_specific:   oyning aniq sanalarida (1-31). Masalan, [1, 15]
export type GoalCadence =
  | { kind: "daily" }
  | { kind: "count"; targetPerWeek: number }
  | { kind: "specific"; days: number[] }
  | { kind: "monthly_count"; targetPerMonth: number }
  | { kind: "monthly_specific"; daysOfMonth: number[] };

export type Goal = {
  id: string;
  title: string;
  why: string;
  scope: "yearly" | "monthly" | "weekly" | "daily";
  // Yangi cadence — haftalik va kunlik maqsadlar uchun majburiy.
  // Oylik/yillik maqsadlarda undefined bo'lishi mumkin (qo'lda progress).
  cadence?: GoalCadence;
  // Ixtiyoriy vaqt belgisi — HH:MM formatida (24h). Masalan, "07:00" — Bomdod
  // oldidan. Bo'sh bo'lsa "kun davomida" deb hisoblanadi.
  timeOfDay?: string;
  // Bajarilgan kunlar ro'yxati — ISO YYYY-MM-DD formatida.
  completedDates: string[];
  createdAt: number;
  // Maqsadlar iyerarxiyasi: katta maqsadning qismi bo'lishi mumkin.
  // Yillik → oylik → haftalik → kunlik tartibida.
  parentId?: string;
  // Eski ko'rinish maydonlari — endi compute qilinadi (backwards-compat).
  progress?: number;
  sub?: string;
  days?: string;
};

export type Task = {
  id: string;
  time: string;
  label: string;
  done: boolean;
  now?: boolean;
};

// Bugungi niyatlar — kun davomida qo'shiladi, har biri "Bajardim" bilan tugatiladi.
export type NiyatItem = {
  id: string;
  text: string;
  createdAt: number;
  completedAt: number | null;
};

export type CoachMessage = {
  id: string;
  from: "coach" | "user";
  text: string;
  createdAt: number;
};

export type ProfileStat = {
  id: string;
  label: string;
  value: string;
};

export const profile = {
  name: "Bek Aliyev",
  firstName: "Bek",
  level: "Inson 2.3 darajasi",
  levelProgress: 0.62,
  pointsToNext: 340,
  nextLevel: "v2.4",
  hijriDate: "12 Zulqada 1447",
  gregorianDate: "19 May 2026",
  coachKnowsForDays: 47,
};

export const initialNiyat =
  "Bugun telefonni soat 22:00 dan keyin qo'limga olmayman. Onamga qo'ng'iroq qilaman.";

export const prayers: Prayer[] = [
  { id: "fajr", name: "Bomdod", time: "04:32", state: "done" },
  { id: "dhuhr", name: "Peshin", time: "12:48", state: "done" },
  { id: "asr", name: "Asr", time: "16:42", state: "now" },
  { id: "maghrib", name: "Shom", time: "19:24", state: "next" },
  { id: "isha", name: "Xufton", time: "21:02", state: "next" },
];

export const todayTasks: Task[] = [
  { id: "t1", time: "06:00", label: "Bomdod namozi", done: true },
  { id: "t2", time: "07:30", label: "30 daqiqa Qur'on tilovati", done: true },
  { id: "t3", time: "10:00", label: "Frontend kursi — 2-modul", done: false, now: true },
  { id: "t4", time: "20:00", label: "Onaga qo'ng'iroq", done: false },
];

export const goals: Goal[] = [
  {
    id: "g1",
    title: "Haftada 4 marta sportzal",
    why: "Tana — Alloh amonati",
    scope: "weekly",
    cadence: { kind: "count", targetPerWeek: 4 },
    timeOfDay: "06:30",
    completedDates: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
  {
    id: "g2",
    title: "Juz 28 ni yodlash",
    why: "Qiyomat kuni Qur'on shafoat qiladi",
    progress: 0.6,
    sub: "60% tugadi",
    days: "12 kun",
    scope: "monthly",
    completedDates: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
  },
  {
    id: "g3",
    title: "Frontend kursini tugatish",
    why: "Mustaqil daromad — oilam uchun",
    progress: 8 / 12,
    sub: "8/12 modul",
    days: "3 hafta",
    scope: "monthly",
    completedDates: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  },
  {
    id: "g4",
    title: "Onamga har kuni qo'ng'iroq",
    why: "Vaqt o'tib ketmoqda, men sezmayapman",
    scope: "weekly",
    cadence: { kind: "daily" },
    timeOfDay: "20:00",
    completedDates: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
];

export const initialCoachMessages: CoachMessage[] = [
  {
    id: "m1",
    from: "coach",
    text: `Bek, bugun yaxshi boshlanding. Bomdodga vaqtida turding — bu 5-kun ketma-ket. Lekin men ko'ryapmanki, soat 6:47 da Instagram ochding va 23 daqiqa qoldim. Nima bo'ldi?`,
    createdAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "m2",
    from: "user",
    text: "Zerikkan edim, bomdoddan keyin uyqu kelmay turardi",
    createdAt: Date.now() - 1000 * 60 * 28,
  },
  {
    id: "m3",
    from: "coach",
    text:
      "Tushunaman. Bomdoddan keyin tana faol, lekin miya hali joyiga kelmagan — bu tabiiy. Lekin Instagram bu vaqtda eng yomon tanlov, chunki dofamin urib ketib, keyin butun kun pasaytirib qo'yadi.\n\nErtaga shu vaqt uchun nima qilamiz? 3 ta variant beraman:\n• 15 daqiqa Qur'on tilovati (eng yaxshi)\n• Yengil yurish — 20 daqiqa havoda\n• Kitob — ozgina, 10-bet",
    createdAt: Date.now() - 1000 * 60 * 27,
  },
];

export const coachSuggestionChips = [
  "Qur'on tilovati",
  "Yurish",
  "Kitob",
  "O'zim tanlayman",
];

// Sadaqa kunlari — kalendar logikasiga to'g'ri keladi (visible day raqami).
export const sadaqaDoneDays = [2, 4, 5, 8, 9, 13, 16, 17, 18];
export const sadaqaToday = 19;

// Zam suralar — Juz Amma (30-juz)dagi qisqa suralar.
// Ko'pchilik musulmonlar yodlaydigan, namozda o'qiladigan suralar.
// Har kuni shu pool'dan 3 tasi rotatsiya bilan tanlanadi (sana asosli, deterministik).
export type ShortSurah = { id: string; number: number; arabic: string; latin: string };

export const ZAM_SURAHS: ShortSurah[] = [
  { id: "fatiha", number: 1, arabic: "الفاتحة", latin: "Al-Fatiha" },
  { id: "naba", number: 78, arabic: "النبأ", latin: "An-Naba" },
  { id: "naziat", number: 79, arabic: "النازعات", latin: "An-Naziat" },
  { id: "abasa", number: 80, arabic: "عبس", latin: "Abasa" },
  { id: "takwir", number: 81, arabic: "التكوير", latin: "At-Takwir" },
  { id: "infitar", number: 82, arabic: "الانفطار", latin: "Al-Infitar" },
  { id: "mutaffifin", number: 83, arabic: "المطففين", latin: "Al-Mutaffifin" },
  { id: "inshiqaq", number: 84, arabic: "الانشقاق", latin: "Al-Inshiqaq" },
  { id: "buruj", number: 85, arabic: "البروج", latin: "Al-Buruj" },
  { id: "tariq", number: 86, arabic: "الطارق", latin: "At-Tariq" },
  { id: "ala", number: 87, arabic: "الأعلى", latin: "Al-A'la" },
  { id: "ghashiya", number: 88, arabic: "الغاشية", latin: "Al-Ghashiya" },
  { id: "fajr", number: 89, arabic: "الفجر", latin: "Al-Fajr" },
  { id: "balad", number: 90, arabic: "البلد", latin: "Al-Balad" },
  { id: "shams", number: 91, arabic: "الشمس", latin: "Ash-Shams" },
  { id: "layl", number: 92, arabic: "الليل", latin: "Al-Layl" },
  { id: "duha", number: 93, arabic: "الضحى", latin: "Ad-Duha" },
  { id: "sharh", number: 94, arabic: "الشرح", latin: "Ash-Sharh" },
  { id: "tin", number: 95, arabic: "التين", latin: "At-Tin" },
  { id: "alaq", number: 96, arabic: "العلق", latin: "Al-Alaq" },
  { id: "qadr", number: 97, arabic: "القدر", latin: "Al-Qadr" },
  { id: "bayyina", number: 98, arabic: "البينة", latin: "Al-Bayyina" },
  { id: "zalzala", number: 99, arabic: "الزلزلة", latin: "Az-Zalzala" },
  { id: "adiyat", number: 100, arabic: "العاديات", latin: "Al-Adiyat" },
  { id: "qaria", number: 101, arabic: "القارعة", latin: "Al-Qari'a" },
  { id: "takathur", number: 102, arabic: "التكاثر", latin: "At-Takathur" },
  { id: "asr", number: 103, arabic: "العصر", latin: "Al-Asr" },
  { id: "humaza", number: 104, arabic: "الهمزة", latin: "Al-Humaza" },
  { id: "fil", number: 105, arabic: "الفيل", latin: "Al-Fil" },
  { id: "quraysh", number: 106, arabic: "قريش", latin: "Quraysh" },
  { id: "maun", number: 107, arabic: "الماعون", latin: "Al-Ma'un" },
  { id: "kawthar", number: 108, arabic: "الكوثر", latin: "Al-Kawthar" },
  { id: "kafirun", number: 109, arabic: "الكافرون", latin: "Al-Kafirun" },
  { id: "nasr", number: 110, arabic: "النصر", latin: "An-Nasr" },
  { id: "masad", number: 111, arabic: "المسد", latin: "Al-Masad" },
  { id: "ikhlas", number: 112, arabic: "الإخلاص", latin: "Al-Ikhlas" },
  { id: "falaq", number: 113, arabic: "الفلق", latin: "Al-Falaq" },
  { id: "nas", number: 114, arabic: "الناس", latin: "An-Nas" },
];

// Sana asosida deterministik tarzda 3 ta sura tanlash.
// Bir kun davomida har doim bir xil suralar; ertaga boshqa 3 tasi.
export function getTodayZamSurahs(date: Date = new Date()): ShortSurah[] {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const total = ZAM_SURAHS.length;
  // 3 ta turli pozitsiya — dayOfYear bo'yicha siljiydi
  return [
    ZAM_SURAHS[dayOfYear % total],
    ZAM_SURAHS[(dayOfYear * 7 + 13) % total],
    ZAM_SURAHS[(dayOfYear * 11 + 29) % total],
  ];
}

export const memorization = {
  juz: "Juz 30",
  done: 27,
  total: 37,
  // Eski bo'lgan default — getTodayZamSurahs() ishlatish tavsiya etiladi
  todaySurahs: getTodayZamSurahs(),
};

// Kuniga 1 marta o'qish uchun tavsiya etilgan suralar.
// ZAM_SURAHS + mashhur to'liq suralar (Yasin, Ar-Rahman, Al-Kahf, Al-Mulk va h.k.).
// ZAM_SURAHS allaqachon Al-Fatiha'ni o'z ichiga oladi, shu sabab uni qayta
// qo'shmaymiz — aks holda React duplicate key xato beradi.
export const DAILY_QURAN_SURAHS: ShortSurah[] = [
  // Mashhur to'liq suralar (Al-Fatiha pastda ZAM_SURAHS ichida)
  { id: "kahf", number: 18, arabic: "الكهف", latin: "Al-Kahf" },
  { id: "yasin", number: 36, arabic: "يس", latin: "Yasin" },
  { id: "rahman", number: 55, arabic: "الرحمن", latin: "Ar-Rahman" },
  { id: "waqia", number: 56, arabic: "الواقعة", latin: "Al-Waqia" },
  { id: "mulk", number: 67, arabic: "الملك", latin: "Al-Mulk" },
  // Juz Amma — qisqa suralar (Al-Fatiha bilan)
  ...ZAM_SURAHS,
];

// Sana asosida deterministik tarzda kunlik tavsiya etilgan surani tanlash.
export function getTodayQuranSurah(date: Date = new Date()): ShortSurah {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return DAILY_QURAN_SURAHS[dayOfYear % DAILY_QURAN_SURAHS.length];
}

// Backwards-compat — eski quranToday format
export const quranToday = {
  surah: "Al-Mulk",
  ayah: 8,
  streakDays: 23,
};

export const todayHadith = {
  text: "Eng yaxshilaringiz — ahliga eng yaxshisi bo'lganlaringizdir.",
  source: "Tirmiziy",
};

export const profileStats: ProfileStat[] = [
  { id: "s1", label: "Streak rekordi", value: "47 kun" },
  { id: "s2", label: "Ekran vaqti tejaldi", value: "127 soat" },
  { id: "s3", label: "Bajarilgan maqsadlar", value: "89" },
  { id: "s4", label: "Qur'on o'qildi", value: "14 marta xatm" },
];

export const settingsMenu = [
  { id: "ai", label: "AI shaxsiyati" },
  { id: "notif", label: "Bildirishnomalar" },
  { id: "prayer", label: "Namoz sozlamalari" },
  { id: "voice", label: "Ovoz va til" },
  { id: "privacy", label: "Maxfiylik" },
  { id: "premium", label: "Premium obuna" },
  { id: "help", label: "Yordam" },
];

export const homeStats = {
  screenTimeToday: "2s 14d",
  screenTimeDelta: 32,
  goalsDone: 4,
  goalsTotal: 7,
  streakDays: 12,
};

export const nextPrayerHero = {
  name: "Asr",
  time: "16:42",
  countdown: "2 soat 14 daqiqada",
};

// Joriy oy kunlar soni — sadaqa kalendari uchun.
// MVP'da current month length'ni real Date orqali olamiz.
export function getDaysInCurrentMonth(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}
