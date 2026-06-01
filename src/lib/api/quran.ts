// Quran.com API klienti — to'liq oyatlar, lotin transliteratsiya, o'zbek tarjima, tilovat.
// Docs: https://quran.api-docs.io/v4
// CORS yoqilgan — to'g'ridan-to'g'ri brauzer'dan chaqirish mumkin.

const API_BASE = "https://api.quran.com/api/v4";

// Tavsiya etilgan o'zbek tarjimalari (Quran.com translation_id):
// 127 — Muhammad Sodiq Muhammad Yusuf (Kirill alifbosida)
// Quran.com'da o'zbek tarjimalari faqat Kirill — lotinga avto-konvertatsiya qilamiz.
export const UZ_TRANSLATION_ID = 127;

// Tavsiya etilgan qori (reciter_id):
// 7 — Mishary Rashid Alafasy
// 4 — Abdur Rahman as-Sudais
// 1 — Abdul Basit Abdus Samad
export const DEFAULT_RECITER_ID = 7;

export type QuranVerse = {
  verseNumber: number; // surah ichida tartib
  verseKey: string; // "114:1"
  arabic: string; // Uthmaniy yozuv
  transliteration: string; // Arabchaning lotincha o'qilishi (so'z-so'z birlashtirilgan)
  translation: string; // O'zbekcha tarjima (lotin alifbosida, Kirill'dan aylantirilgan)
};

export type QuranAudio = {
  audioUrl: string;
  reciterId: number;
};

// Quran.com /verses/by_chapter — words va translations bilan birga
type ApiByChapterResponse = {
  verses: Array<{
    id: number;
    verse_key: string;
    text_uthmani?: string;
    words?: Array<{
      text?: string;
      transliteration?: { text: string | null };
      char_type_name?: string;
    }>;
    translations?: Array<{ resource_id: number; text: string }>;
  }>;
};

type ApiAudioResponse = {
  audio_file: {
    id: number;
    chapter_id: number;
    audio_url: string;
  };
};

function htmlToText(html: string): string {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Kirill alifbosida yozilgan o'zbek matnini lotin alifbosiga aylantirish.
// 2019-yilgi rasmiy o'zbek lotin alifbosi me'yorlariga muvofiq.
const UZ_CYRILLIC_MAP: Record<string, string> = {
  А: "A", а: "a",
  Б: "B", б: "b",
  В: "V", в: "v",
  Г: "G", г: "g",
  Д: "D", д: "d",
  Е: "E", е: "e",
  Ё: "Yo", ё: "yo",
  Ж: "J", ж: "j",
  З: "Z", з: "z",
  И: "I", и: "i",
  Й: "Y", й: "y",
  К: "K", к: "k",
  Л: "L", л: "l",
  М: "M", м: "m",
  Н: "N", н: "n",
  О: "O", о: "o",
  П: "P", п: "p",
  Р: "R", р: "r",
  С: "S", с: "s",
  Т: "T", т: "t",
  У: "U", у: "u",
  Ў: "O'", ў: "o'",
  Ф: "F", ф: "f",
  Х: "X", х: "x",
  Ҳ: "H", ҳ: "h",
  Ч: "Ch", ч: "ch",
  Ш: "Sh", ш: "sh",
  Ъ: "'", ъ: "'",
  Ы: "I", ы: "i",
  Ь: "",
  ь: "",
  Э: "E", э: "e",
  Ю: "Yu", ю: "yu",
  Я: "Ya", я: "ya",
  Қ: "Q", қ: "q",
  Ғ: "G'", ғ: "g'",
  Ц: "Ts", ц: "ts",
};

export function uzCyrillicToLatin(text: string): string {
  if (!text) return "";
  let result = "";
  for (const ch of text) {
    result += UZ_CYRILLIC_MAP[ch] ?? ch;
  }
  // Manbada oyat oxiri/boshida "..." (uch nuqta) bo'ladi — ularni tozalaymiz.
  // Shu bilan birga ortiqcha ko'p probelar va ellips '…' belgilari ham.
  return result
    .replace(/\.{3,}/g, "")
    .replace(/…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Akademik transliteratsiya'ni o'qishga qulay shaklga aylantirish.
// Misol: "qul aʿūdhu birabbi l-nāsi" → "qul a'uzu birabbi nnasi"
// Bu o'zbek tilida o'qish uchun mo'ljallangan — fonetik diakritik
// belgilar tashlanadi, hamza/ayn apostrof bilan almashinadi.
const TRANSLIT_DIACRITICS: Record<string, string> = {
  "ʿ": "'", // ayn
  "ʾ": "'", // hamza
  "ā": "a", "ī": "i", "ū": "u",
  "Ā": "A", "Ī": "I", "Ū": "U",
  ṣ: "s", ḍ: "d", ḥ: "h", ẓ: "z", ṭ: "t",
  Ṣ: "S", Ḍ: "D", Ḥ: "H", Ẓ: "Z", Ṭ: "T",
  ʼ: "'",
};

export function simplifyTransliteration(text: string): string {
  if (!text) return "";
  let result = "";
  for (const ch of text) {
    result += TRANSLIT_DIACRITICS[ch] ?? ch;
  }
  return result;
}

// Birinchi harfni katta qilish (Unicode-aware).
function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("en") + s.slice(1);
}

// Bitta so'rovda hammasi: arabcha, so'zlar (transliteratsiya), tarjima.
// /verses/by_chapter endpoint qulay — barcha kerakli ma'lumotlar bir paketda keladi.
export async function fetchSurahVerses(
  surahNumber: number,
  translationId: number = UZ_TRANSLATION_ID,
  signal?: AbortSignal,
): Promise<QuranVerse[]> {
  const params = new URLSearchParams({
    words: "true",
    translations: String(translationId),
    fields: "text_uthmani",
    word_fields: "transliteration,char_type_name",
    per_page: "300", // har sura sig'adigan miqdor
  });
  const url = `${API_BASE}/verses/by_chapter/${surahNumber}?${params}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Quran API ${res.status}`);
  }
  const data = (await res.json()) as ApiByChapterResponse;

  return data.verses.map((v) => {
    const verseNumber = parseInt(v.verse_key.split(":")[1] ?? "0", 10);
    // Transliteratsiya so'zlardan yig'iladi. "end" tipidagi belgilar (oyat
    // oxiri ✿) tashlanadi. Akademik diakritiklar olib tashlanib, o'qishga
    // qulay shaklga keltiriladi.
    const rawTranslit =
      v.words
        ?.filter(
          (w) =>
            w.char_type_name !== "end" &&
            w.transliteration?.text &&
            w.transliteration.text.length > 0,
        )
        .map((w) => w.transliteration!.text)
        .join(" ") ?? "";
    // Har oyat birinchi harfi katta — birlashtirilganda jumla boshi aniq ko'rinadi
    const transliteration = capitalizeFirst(simplifyTransliteration(rawTranslit));

    // Tarjima — Kirill'dan lotinga konversiya
    const rawTranslation = v.translations?.[0]?.text ?? "";
    const translation = uzCyrillicToLatin(htmlToText(rawTranslation));

    return {
      verseNumber,
      verseKey: v.verse_key,
      arabic: v.text_uthmani ?? "",
      transliteration: transliteration.replace(/\s+/g, " ").trim(),
      translation,
    };
  });
}

// Qur'on'dagi barcha 114 surah ro'yxati — sarlavhalar va metadata.
export type QuranChapter = {
  id: number; // 1-114
  nameArabic: string;
  nameLatin: string; // "An-Nas"
  versesCount: number;
  revelationPlace: "makkah" | "madinah";
};

type ApiChaptersResponse = {
  chapters: Array<{
    id: number;
    name_arabic: string;
    name_simple: string;
    verses_count: number;
    revelation_place: "makkah" | "madinah";
  }>;
};

export async function fetchAllChapters(signal?: AbortSignal): Promise<QuranChapter[]> {
  const res = await fetch(`${API_BASE}/chapters`, { signal });
  if (!res.ok) throw new Error(`Quran API chapters ${res.status}`);
  const data = (await res.json()) as ApiChaptersResponse;
  return data.chapters.map((c) => ({
    id: c.id,
    nameArabic: c.name_arabic,
    nameLatin: c.name_simple,
    versesCount: c.verses_count,
    revelationPlace: c.revelation_place,
  }));
}

// Mavjud qorilar ro'yxati (chapter recitations — butun sura uchun)
export type QuranReciter = {
  id: number;
  name: string; // "Mishary Rashid Alafasy"
  style?: string; // "Murattal", "Mujawwad" va h.k.
};

type ApiRecitationsResponse = {
  recitations: Array<{
    id: number;
    reciter_name: string;
    style?: string;
    translated_name?: { name: string; language_name: string };
  }>;
};

// Quran.com'dagi qorilar — saralangan eng mashhur va o'zbeklar yaxshi
// taniydigan qorilar. Bu ID'lar barqaror.
export const POPULAR_RECITERS: QuranReciter[] = [
  { id: 7, name: "Mishary Rashid Alafasy", style: "Murattal" },
  { id: 4, name: "Abu Bakr Al-Shatri", style: "Murattal" },
  { id: 3, name: "Abdur-Rahman as-Sudais", style: "Murattal" },
  { id: 6, name: "Mahmoud Khalil Al-Husary", style: "Murattal" },
  { id: 5, name: "Hani Ar-Rifai", style: "Murattal" },
  { id: 12, name: "Mohamed Siddiq Al-Minshawi", style: "Murattal" },
  { id: 2, name: "AbdulBaset AbdulSamad", style: "Murattal" },
  { id: 1, name: "AbdulBaset AbdulSamad", style: "Mujawwad" },
];

export async function fetchReciters(signal?: AbortSignal): Promise<QuranReciter[]> {
  try {
    const res = await fetch(`${API_BASE}/resources/recitations`, { signal });
    if (!res.ok) {
      // Server javob bermasa — saralangan ro'yxatni qaytaramiz
      return POPULAR_RECITERS;
    }
    const data = (await res.json()) as ApiRecitationsResponse;
    // Faqat chapter_recitations'da audio'si mavjudlari (Murattal asosan).
    // POPULAR_RECITERS ichidagi ID'larni tartibga keltirib qaytaramiz —
    // qolganlarining hammasi pastda.
    const popularIds = new Set(POPULAR_RECITERS.map((r) => r.id));
    const allFromApi: QuranReciter[] = data.recitations.map((r) => ({
      id: r.id,
      name: r.reciter_name,
      style: r.style,
    }));
    const popular = POPULAR_RECITERS.filter((p) =>
      allFromApi.some((r) => r.id === p.id),
    );
    const others = allFromApi.filter((r) => !popularIds.has(r.id));
    return [...popular, ...others];
  } catch {
    return POPULAR_RECITERS;
  }
}

// Surah'ning tilovat audio URL'sini olish (butun surah, bitta MP3).
export async function fetchSurahAudio(
  surahNumber: number,
  reciterId: number = DEFAULT_RECITER_ID,
  signal?: AbortSignal,
): Promise<QuranAudio> {
  const res = await fetch(
    `${API_BASE}/chapter_recitations/${reciterId}/${surahNumber}`,
    { signal },
  );
  if (!res.ok) {
    throw new Error(`Quran API audio ${res.status}`);
  }
  const data = (await res.json()) as ApiAudioResponse;
  return {
    audioUrl: data.audio_file.audio_url,
    reciterId,
  };
}
