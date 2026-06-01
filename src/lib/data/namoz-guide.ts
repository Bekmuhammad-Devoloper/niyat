// Namoz o'qish qo'llanmasi — Hanafiy mazhabi bo'yicha qadam-baqadam.
// Manba: islom.uz va Hanafiy fiqh kitoblari (Nurul Iyzoh, Marokiyul falah).
// Bu fayl FAQAT farzlarni ko'rsatadi — sunnat/nafl alohida featureda qo'shiladi.

export type PrayerPosition =
  | "niyat"
  | "qiyom"
  | "ruku"
  | "qowma"
  | "sajda"
  | "jalsa"
  | "tashahhud"
  | "salom";

export type PrayerStep = {
  id: string;
  // Foydalanuvchiga ko'rsatiladigan qisqa sarlavha
  title: string;
  // Tana holati — yuqorida rasm yoki ikonka ko'rsatish uchun
  position: PrayerPosition;
  // Arabchada o'qiladi (agar dua/oyat bo'lsa)
  arabic?: string;
  // Lotin transliteratsiya (uzbekcha o'qilishi)
  transliteration?: string;
  // Ozbekcha tarjima
  translation?: string;
  // Qo'shimcha tushuntirish (fiqh nuances, masalan: imom bilan jamoatda farqi)
  note?: string;
};

export type PrayerRakaat = {
  number: 1 | 2 | 3 | 4;
  steps: PrayerStep[];
};

export type NamozId = "bomdod" | "peshin" | "asr" | "shom" | "xufton";

export type Namoz = {
  id: NamozId;
  name: string;
  arabicName: string;
  // Farz rakatlar soni
  rakaats: number;
  // Vaqt tavsifi
  timeDesc: string;
  // Sirli (ichida) yoki ovozli (jahriy) o'qish
  recitation: "sirli" | "jahriy";
  steps: PrayerRakaat[];
};

// =============================================================
// Umumiy iboralar — har bir namozda takrorlanadi
// =============================================================

const FOTIHA: PrayerStep = {
  id: "fotiha",
  title: "Fotiha surasi",
  position: "qiyom",
  arabic:
    "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۝ ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَالَمِينَ ۝ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۝ مَالِكِ يَوْمِ ٱلدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ ٱهْدِنَا ٱلصِّرَاطَ ٱلْمُسْتَقِيمَ ۝ صِرَاطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ",
  transliteration:
    "Bismillahir-rohmanir-rohiym. Alhamdulillahi robbil-alamiyn. Ar-rohmanir-rohiym. Maliki yawmid-diyn. Iyyaka na'budu va iyyaka nasta'iyn. Ihdinas-siratal-mustaqiym. Siratal-laziyna an'amta alayhim ġoyril-maġḍubi alayhim va laḍ-ḍolliyn.",
  translation:
    "Mehribon va rahmli Alloh nomi bilan boshlayman. Olamlar Robbi — Allohga hamd. U mehribon va rahmlidir. Qiyomat kunining egasi. Faqat Senga ibodat qilamiz va faqat Sendan yordam so'raymiz. Bizni to'g'ri yo'lga hidoyat qilgin — ne'mat bergan zotlaring yo'liga, g'azab qilinganlar va adashganlar yo'liga emas.",
  note: "Har rakatda majburiy o'qiladi. Oxiri 'Omiyn' deyiladi (sirli namozda jim, jahriyda imom orqasidan).",
};

const RUKU: PrayerStep = {
  id: "ruku",
  title: "Ruku — egilish",
  position: "ruku",
  arabic: "سُبْحَانَ رَبِّيَ ٱلْعَظِيمِ",
  transliteration: "Subhana robbiyal-aziym (3 marta)",
  translation: "Buyuk Robbim pokdir.",
  note: "Belni to'g'ri, kaftlar tizzaga, ko'z oyoq uchiga qaratiladi. Kamida 3 marta tasbih aytiladi.",
};

const QOWMA: PrayerStep = {
  id: "qowma",
  title: "Qowma — ruku'dan tik turish",
  position: "qowma",
  arabic: "سَمِعَ ٱللَّهُ لِمَنْ حَمِدَهُ ۝ رَبَّنَا وَلَكَ ٱلْحَمْدُ",
  transliteration: "Sami'allohu liman hamidah. Robbana va lakal-hamd.",
  translation:
    "Alloh O'ziga hamd aytganlarni eshitadi. Ey Robbimiz, Senga hamd bo'lsin.",
  note: "Imom 'Sami'allohu liman hamidah' deydi, jamoat 'Robbana va lakal-hamd' deydi. Yolg'iz o'qisa, ikkalasini ham aytadi.",
};

const SAJDA: PrayerStep = {
  id: "sajda",
  title: "Sajda — yerga bosh qo'yish",
  position: "sajda",
  arabic: "سُبْحَانَ رَبِّيَ ٱلْأَعْلَىٰ",
  transliteration: "Subhana robbiyal-a'la (3 marta)",
  translation: "Eng oliy Robbim pokdir.",
  note: "Peshona, burun, ikki kaft, ikki tizza, oyoq barmoqlari — 7 a'zo yerga tegishi shart. Tirsaklar erga tegmasin.",
};

const JALSA: PrayerStep = {
  id: "jalsa",
  title: "Jalsa — ikki sajda orasida o'tirish",
  position: "jalsa",
  arabic: "رَبِّ ٱغْفِرْ لِي",
  transliteration: "Robbiġfir liy",
  translation: "Ey Robbim, meni kechir.",
  note: "Chap oyoqni yotqizib, o'ng oyoqning barmoqlari qiblaga qaratilgan holda o'tiriladi. Qisqa to'xtam.",
};

const SAJDA_2: PrayerStep = { ...SAJDA, id: "sajda-2", title: "Sajda (2-marta)" };

const TASHAHHUD: PrayerStep = {
  id: "tashahhud",
  title: "Tashahhud — At-tahiyyot",
  position: "tashahhud",
  arabic:
    "ٱلتَّحِيَّاتُ لِلَّهِ وَٱلصَّلَوَاتُ وَٱلطَّيِّبَاتُ ۝ ٱلسَّلَامُ عَلَيْكَ أَيُّهَا ٱلنَّبِيُّ وَرَحْمَةُ ٱللَّهِ وَبَرَكَاتُهُ ۝ ٱلسَّلَامُ عَلَيْنَا وَعَلَىٰ عِبَادِ ٱللَّهِ ٱلصَّالِحِينَ ۝ أَشْهَدُ أَنْ لَّا إِلَٰهَ إِلَّا ٱللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ",
  transliteration:
    "At-tahiyyatu lillahi va-s-solavatu va-t-toyyibat. As-salamu alayka ayyuhan-nabiyyu va rohmatullohi va barokatuh. As-salamu alayna va ala ibadillahis-solihiyn. Ash-hadu an la ilaha illalloh, va ash-hadu anna Muhammadan abduhu va rosuluh.",
  translation:
    "Barcha sano va ibodatlar Allohga xosdir. Ey Payg'ambar, sizga salom va Allohning rahmati hamda barakoti bo'lsin. Bizga va Allohning solih bandalariga ham salom bo'lsin. Allohdan boshqa iloh yo'qligiga va Muhammad — Uning bandasi va elchisi ekanligiga guvohlik beraman.",
  note: "Hanafiyda 'la ilaha' so'zida o'ng qo'lning ko'rsatkich barmog'i ko'tariladi, 'illalloh'da tushiriladi.",
};

const SALAVAT_DUA: PrayerStep = {
  id: "salavat",
  title: "Salavat va dua",
  position: "tashahhud",
  arabic:
    "ٱللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَىٰ إِبْرَاهِيمَ وَعَلَىٰ آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَّجِيدٌ",
  transliteration:
    "Allohumma solli ala Muhammadin va ala ali Muhammad, kama sollayta ala Ibrohima va ala ali Ibrohima, innaka hamiydun majiyd. Allohumma barik ala Muhammadin va ala ali Muhammad, kama barokta ala Ibrohima va ala ali Ibrohima, innaka hamiydun majiyd.",
  translation:
    "Ey Alloh, Muhammad va uning oilasiga rahmat yog'dirgin — Ibrohim va uning oilasiga rahmat yog'dirganing kabi. Sen — maqtovga loyiq, oliy zotsan.",
  note: "Faqat oxirgi rakatdagi tashahhuddan keyin o'qiladi.",
};

const SALOM: PrayerStep = {
  id: "salom",
  title: "Salom berish",
  position: "salom",
  arabic: "ٱلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ ٱللَّهِ",
  transliteration: "Assalamu alaykum va rohmatulloh (o'ng + chap)",
  translation: "Sizga salom va Allohning rahmati bo'lsin.",
  note: "Avval o'ng yelka tomonga, keyin chap yelka tomonga qaragancha salom beriladi. Namoz tugaydi.",
};

// =============================================================
// 1-rakat (Sana + Fotiha + Zam sura + Ruku + Sajdalar)
// =============================================================

const RAKAAT_1_TAKBIR: PrayerStep[] = [
  {
    id: "niyat",
    title: "Niyat — qalbda",
    position: "niyat",
    translation:
      "Qalbda: 'Men bugungi [namoz nomi] farzini Alloh uchun o'qiyman' deb niyat qilinadi. Til bilan aytish shart emas.",
    note: "Niyat ibodatning ruhi. Qalbda aniq bo'lishi yetarli.",
  },
  {
    id: "takbir-ehrom",
    title: "Takbiratul-ehrom",
    position: "qiyom",
    arabic: "ٱللَّهُ أَكْبَرُ",
    transliteration: "Allohu akbar",
    translation: "Alloh eng buyukdir.",
    note: "Ikki qo'l quloq yumshog'iga ko'tariladi, keyin kindik ostida bog'lanadi (erkak), ko'krak ustida (ayol).",
  },
  {
    id: "sana",
    title: "Sana — Sano",
    position: "qiyom",
    arabic:
      "سُبْحَانَكَ ٱللَّهُمَّ وَبِحَمْدِكَ ۝ وَتَبَارَكَ ٱسْمُكَ ۝ وَتَعَالَىٰ جَدُّكَ ۝ وَلَا إِلَٰهَ غَيْرُكَ",
    transliteration:
      "Subhanaka Allohumma va bihamdika, va tabaraka ismuka, va ta'ala jadduka, va la ilaha ġoyruka.",
    translation:
      "Ey Alloh, Sen poksan va Senga hamd bo'lsin. Isming muborak, ulug'liging baland, Sendan o'zga iloh yo'q.",
  },
  {
    id: "auzu",
    title: "Ta'avvuz (Auzu billah)",
    position: "qiyom",
    arabic: "أَعُوذُ بِٱللَّهِ مِنَ ٱلشَّيْطَانِ ٱلرَّجِيمِ",
    transliteration: "A'uzu billahi minash-shaytonir-rojiym.",
    translation: "Quvilgan shaytondan Allohdan panoh so'rayman.",
    note: "Faqat birinchi rakatda, Sana'dan keyin va Fotiha'dan oldin o'qiladi. Boshqa rakatlarda o'qilmaydi.",
  },
  {
    id: "bismillah-1",
    title: "Tasmiya (Bismillah)",
    position: "qiyom",
    arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    transliteration: "Bismillahir-rohmanir-rohiym.",
    translation: "Mehribon va rahmli Alloh nomi bilan.",
    note: "Har Fotiha'dan oldin sirli o'qiladi (har rakatda).",
  },
];

// Zam sura — istalgan qisqa sura (Iqlas, Falaq, Nas, Kafirun va h.k.)
const ZAM_SURA_PLACEHOLDER: PrayerStep = {
  id: "zam-sura",
  title: "Zam sura (qisqa sura)",
  position: "qiyom",
  arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَّهُ كُفُوًا أَحَدٌ",
  transliteration:
    "Qul huvallohu ahad. Allohus-somad. Lam yalid va lam yulad. Va lam yakun lahu kufuwan ahad.",
  translation:
    "Ayt: U — Alloh yagonadir. Alloh — barchaning ehtiyojini ko'taradi. Tug'magan va tug'ilmagan. Hech kim Unga teng emas.",
  note: "Faqat birinchi 2 rakatda o'qiladi. Ixlos surasi misol; istalgan qisqa sura mumkin.",
};

function buildRakaat1(withZamSura = true): PrayerStep[] {
  return [
    ...RAKAAT_1_TAKBIR,
    FOTIHA,
    ...(withZamSura ? [ZAM_SURA_PLACEHOLDER] : []),
    RUKU,
    QOWMA,
    SAJDA,
    JALSA,
    SAJDA_2,
  ];
}

function buildRakaat2WithFotihaAndZam(): PrayerStep[] {
  return [
    {
      id: "qiyom-2",
      title: "Qiyom — turish",
      position: "qiyom",
      translation:
        "Sajda'dan turib, qaytadan qo'l bog'lanadi. Sana va Auzu O'QILMAYDI — to'g'ri Bismillah'dan Fotiha boshlanadi.",
    },
    {
      id: "bismillah-2",
      title: "Bismillah",
      position: "qiyom",
      arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
      transliteration: "Bismillahir-rohmanir-rohiym",
      translation: "Mehribon va rahmli Alloh nomi bilan.",
    },
    FOTIHA,
    ZAM_SURA_PLACEHOLDER,
    RUKU,
    QOWMA,
    SAJDA,
    JALSA,
    SAJDA_2,
    TASHAHHUD,
  ];
}

function buildRakaat3or4Farz(): PrayerStep[] {
  return [
    {
      id: "qiyom-next",
      title: "Qiyom — turish",
      position: "qiyom",
      translation:
        "Tashahhud'dan keyin Allohu akbar deb tik turiladi va qo'l bog'lanadi.",
      note: "Farz namozning 3 va 4-rakatlarida ZAM SURA o'qilmaydi — faqat Fotiha.",
    },
    FOTIHA,
    RUKU,
    QOWMA,
    SAJDA,
    JALSA,
    SAJDA_2,
  ];
}

// Oxirgi rakatning so'nggi qismi: tashahhud + salavat + salom
const FINAL_TASHAHHUD_BLOCK: PrayerStep[] = [
  TASHAHHUD,
  SALAVAT_DUA,
  SALOM,
];

// =============================================================
// 5 ta farz namoz
// =============================================================

export const NAMOZLAR: Namoz[] = [
  {
    id: "bomdod",
    name: "Bomdod",
    arabicName: "صَلَاةُ ٱلْفَجْرِ",
    rakaats: 2,
    timeDesc: "Tong otishidan quyosh chiqqunga qadar",
    recitation: "jahriy",
    steps: [
      { number: 1, steps: buildRakaat1(true) },
      {
        number: 2,
        steps: [
          {
            id: "qiyom-2-final",
            title: "Qiyom — turish",
            position: "qiyom",
            translation: "Sajda'dan turib, Sana va Auzu O'QILMAYDI.",
          },
          {
            id: "bismillah-2-bomdod",
            title: "Bismillah",
            position: "qiyom",
            arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
            transliteration: "Bismillahir-rohmanir-rohiym",
            translation: "Mehribon va rahmli Alloh nomi bilan.",
          },
          FOTIHA,
          ZAM_SURA_PLACEHOLDER,
          RUKU,
          QOWMA,
          SAJDA,
          JALSA,
          SAJDA_2,
          ...FINAL_TASHAHHUD_BLOCK,
        ],
      },
    ],
  },
  {
    id: "peshin",
    name: "Peshin",
    arabicName: "صَلَاةُ ٱلظُّهْرِ",
    rakaats: 4,
    timeDesc: "Quyosh tepadan og'gandan keyin",
    recitation: "sirli",
    steps: [
      { number: 1, steps: buildRakaat1(true) },
      { number: 2, steps: buildRakaat2WithFotihaAndZam() },
      { number: 3, steps: buildRakaat3or4Farz() },
      { number: 4, steps: [...buildRakaat3or4Farz(), ...FINAL_TASHAHHUD_BLOCK] },
    ],
  },
  {
    id: "asr",
    name: "Asr",
    arabicName: "صَلَاةُ ٱلْعَصْرِ",
    rakaats: 4,
    timeDesc: "Peshindan keyin, quyosh botishidan oldin",
    recitation: "sirli",
    steps: [
      { number: 1, steps: buildRakaat1(true) },
      { number: 2, steps: buildRakaat2WithFotihaAndZam() },
      { number: 3, steps: buildRakaat3or4Farz() },
      { number: 4, steps: [...buildRakaat3or4Farz(), ...FINAL_TASHAHHUD_BLOCK] },
    ],
  },
  {
    id: "shom",
    name: "Shom",
    arabicName: "صَلَاةُ ٱلْمَغْرِبِ",
    rakaats: 3,
    timeDesc: "Quyosh botgandan keyin",
    recitation: "jahriy",
    steps: [
      { number: 1, steps: buildRakaat1(true) },
      { number: 2, steps: buildRakaat2WithFotihaAndZam() },
      { number: 3, steps: [...buildRakaat3or4Farz(), ...FINAL_TASHAHHUD_BLOCK] },
    ],
  },
  {
    id: "xufton",
    name: "Xufton",
    arabicName: "صَلَاةُ ٱلْعِشَاءِ",
    rakaats: 4,
    timeDesc: "Shafaq yo'qolgandan keyin, tunda",
    recitation: "jahriy",
    steps: [
      { number: 1, steps: buildRakaat1(true) },
      { number: 2, steps: buildRakaat2WithFotihaAndZam() },
      { number: 3, steps: buildRakaat3or4Farz() },
      { number: 4, steps: [...buildRakaat3or4Farz(), ...FINAL_TASHAHHUD_BLOCK] },
    ],
  },
];

// =============================================================
// Ka'ba ma'lumotlari — Qibla yo'nalishi va masofa hisoblash uchun
// =============================================================

export const KAABA_LATITUDE = 21.4225;
export const KAABA_LONGITUDE = 39.8262;

// Haversine formulasi — yer yuzasidagi ikki nuqta orasidagi masofa (km)
export function distanceToKaabaKm(lat: number, lon: number): number {
  const R = 6371; // Yer radiusi km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(KAABA_LATITUDE - lat);
  const dLon = toRad(KAABA_LONGITUDE - lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) *
      Math.cos(toRad(KAABA_LATITUDE)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Qibla yo'nalishi — joriy nuqtadan Ka'baga kompas burchagi (gradus, 0=Shimol)
export function qiblaBearing(lat: number, lon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(lat);
  const lat2 = toRad(KAABA_LATITUDE);
  const dLon = toRad(KAABA_LONGITUDE - lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}
