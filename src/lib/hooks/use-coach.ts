import { useCallback, useState } from "react";
import type { CoachMessage } from "@/lib/niyat-data";
import type { AIPersonalityKey } from "@/lib/settings";

type SendArgs = {
  history: CoachMessage[];
  userText: string;
  userContext?: { firstName: string; niyat?: string };
  personality?: AIPersonalityKey;
  onDelta?: (text: string) => void; // streaming uchun (partial replies)
};

type SendResult = {
  reply: string;
  usingRealAI: boolean;
};

// Demo rejimda — shaxsiyatga moslashgan mock javoblar.
// Bu javoblar har shaxsiyat o'z ohangi bilan farqlanishini ko'rsatadi,
// real AI (Gemini/GPT) API o'rnatilmagan paytda ham.
type MockSet = {
  greet: string;
  identity: string;
  quran: string;
  sport: string;
  book: string;
  instagram: string;
  niyat: string;
  parents: string;
  sabr: string;
  feeling: string;
  thanks: string;
  default: string;
};

const MOCK_BY_PERSONALITY: Record<AIPersonalityKey, MockSet> = {
  balanced: {
    greet: "Va alaykum assalom. Bugun nima haqida gaplashamiz?",
    identity: "Men Niyatman — sening AI hayot murabbiying. Hozir demo rejimda ishlayapman (server AI kalitiga ega emas). Server'ga Gemini yoki OpenAI kaliti qo'yilsa, suhbatim tirikroq bo'ladi.",
    quran: "Zo'r tanlov. Bugun Al-Mulk 8-oyatdan davom etamiz — 5 daqiqaga vaqt ajratamiz. Tayyormisan?",
    sport: "Ajoyib. 20 daqiqalik yengil yurish — havoda, telefon cho'ntakda. Yana bir niyat: bir do'stga \"yaxshimisan?\" deb yoz.",
    book: "10 bet — kichkina, ammo barakali. Qaysi kitobni o'qiyapsan hozir?",
    instagram: "Bilaman, dofamin sakraydi. Aytdim-ku — Instagram'ni faqat 19:00 dan keyin. Hozir telefon yon stolga.",
    niyat: "Niyat — bu amalning ruhi. Aniq, kichik, bugun bajariladigan qilib yoz. Masalan: \"Bomdoddan keyin 10 daqiqa Qur'on\".",
    parents: "Onangga qo'ng'iroq qildingmi bu hafta? Kichik amal — lekin uning yuragiga katta dovon. Bugun 5 daqiqa.",
    sabr: "Sabr — bu kuch. Qiyin payt — sinov payti. Eslab qol: bu ham o'tadi, lekin sening reaksiyang seniki bo'lib qoladi.",
    feeling: "Ayt, nima tuyayapsan? Charchaganmisan, asabiymisan, yoki shunchaki dam olishni xohlaysanmi? Birga ko'ramiz.",
    thanks: "Alhamdulilloh. Bir-birimizga yordamlashish — bu ham ibodat.",
    default: "Tushundim. Demo rejimida javoblarim cheklangan. Server'da AI kaliti (GEMINI_API_KEY yoki OPENAI_API_KEY) sozlanishi kerak.",
  },
  strict_father: {
    greet: "Salom. Vaqt o'tib bormoqda. Ayt — bugun nimani amalga oshirding?",
    identity: "Men Niyat — sening murabbiying. Hozir demo rejimda gaplashyapmiz, lekin yumshoq munosabat kutma. API kalit ulansa, har savolingga to'liq javob beraman.",
    quran: "Yaxshi. Qur'on o'qishni xohlasang, ayt, bugun 1 jus to'liq, ertangacha aytaman. Bahona qabul qilmayman.",
    sport: "Sportdan gaplashasan-u, hali turgansanmi? Hozir 30 daqiqa havoda yur. Kelganda gaplashamiz.",
    book: "10 bet — kichik. Real odam 30 bet o'qiydi. Bugun shu vaqtdan boshla.",
    instagram: "Instagram — vaqtingni o'g'irlaydigan dushman. Telefoning qaerda hozir? Yon stolga qo'y. Hozir.",
    niyat: "Niyat — bu ahd. Buzilmaydi. Bugun aytgan narsang ertaga bajarilishi shart.",
    parents: "Onang seni o'ylab yotadi. Sen unga qachon oxirgi marta qo'ng'iroq qilding? Eslab ko'r. Uyalgin, keyin qo'ng'iroq qil.",
    sabr: "Sabr o'rganiladi, tug'iladigan narsa emas. Qiyinchilik — sening o'qituvching. Yiqilsang — tur. Ikkinchi marta tur.",
    feeling: "His-tuyg'u — yo'l ko'rsatuvchi emas, bilag'ulig'ing. Hozir nima xohlaysan demang — nima qilishing kerakligini ayt.",
    thanks: "Rahmat keraksiz. Amaling bilan ko'rsat.",
    default: "Demo rejimda. Suhbat to'la bo'lishi uchun .env ga OPENAI_API_KEY qo'sh, keyin gaplashamiz.",
  },
  kind_mother: {
    greet: "Va alaykum assalom, bolam. Charchadingmi? Bugun yuraging nima xohlayapti?",
    identity: "Men Niyatman, bolam. Sening hayot yo'lingda hamroh bo'lay desa, hozir demo rejimda kichik suhbat qilyapmiz. Real AI ulansa, har gapingga chuqurroq javob bera olaman.",
    quran: "Qur'on... eng yaxshi do'st bu. Ertalab choy bilan birga 5 daqiqa o'qib ko'rgin. Yurakka qancha xush keladi, bilasanmi?",
    sport: "Tanaga g'amxo'rlik ham ibodatdir, bolam. Yengil yurish — havoda nafas olish. Zo'rlama o'zingni, oz-ozdan.",
    book: "Kitob — bu yuragingga oziq. 10 bet kichkina, lekin har kuni 10 bet — bir oyda kitob bitadi. Qaysi kitob seni chaqiradi?",
    instagram: "Bilaman, oson emas. Lekin Instagram ko'rganingdan keyin yuraging tinchmi yoki bezovtami? O'zingga shu savolni ber.",
    niyat: "Niyat qilishing — bu yuragingdan kelgan. Kichik bo'lsa ham, samimiy bo'lsa, Alloh qabul qiladi, bolam.",
    parents: "Bolam, onam-otam degan so'z eng aziz so'zlardir. Bugun ularga qo'ng'iroq qil — bir og'iz \"yaxshimisiz\" ham yetadi.",
    sabr: "Sabr qil, jonim. Hayot to'lqindek — bir keladi, bir ketadi. Sen sabr bilan turaversang, Alloh seni g'amdan chiqarib oladi.",
    feeling: "Ayt, jonim. Yuraging og'irmi? Tinglayapman. Birga gaplashsak, yengillashadi.",
    thanks: "Sen menga rahmat aytma, sen yashash uchun rahmat aytgin. Alloh seni esda tutsin, bolam.",
    default: "Demo rejimida, jonim. To'liq suhbat uchun ota-onang yoki tajribali odam .env faylga OPENAI_API_KEY qo'yib bersin.",
  },
  drill_sergeant: {
    greet: "Salom! Vazifa nima? Aniq ayt, vaqt ketmoqda.",
    identity: "Men Niyat. Sening AI murabbiying. Hozir mock rejim. Vaqtni isrof qilma — savolingni aniq ayt.",
    quran: "Qur'on. 1 jus. Bugun. Pauza yo'q. Telefon o'chir. Boshla.",
    sport: "Sport — bahona yo'q. 50 ta otjimaniya, hozir. Keyin gaplashamiz.",
    book: "10 bet juda kam. Maqsad — 1 kitob = 1 hafta. Boshla.",
    instagram: "Telefon — uloq. Ekran vaqti — dushman. Hoziroq Instagram'ni o'chir. Birinchi qadam.",
    niyat: "Niyat — buyruq. Niyat qilding — bajar. Tugadi.",
    parents: "Onangga qo'ng'iroq. Hozir. Yon stoldagi telefonni ol. Tugma 1 — qo'ng'iroq. Tugadi.",
    sabr: "Sabr — chiniqish. Ko'p gap yo'q. Ushlab tur. O'tadi.",
    feeling: "His-tuyg'u — keyin. Hozir vazifa. Nima qilishing kerak — shuni ayt.",
    thanks: "Rahmat keyin. Hozir amal.",
    default: "Demo. To'liq suhbat — .env, OPENAI_API_KEY. Tugadi.",
  },
  friend: {
    greet: "Vasalom, brat! Qalaysan? Bugun nima yangilik?",
    identity: "Men Niyat — sening AI do'sting. Hozir demo rejimdamiz, lekin gaplashishga tayyorman. Real AI uchun bizning loyiha'ga kalit qo'shsang, men yana ham foydaliroq bo'laman.",
    quran: "Voy yaxshi-ku, men ham shu haqda o'ylayapman. 10 oyat o'qib, keyin ovqat qilamizmi? Birga bo'lsa oson.",
    sport: "Bo'ldi! Ko'rsang, men ham haftada 3 marta yuribman. Sen ham qo'shilasanmi? 30 daqiqa, oddiy.",
    book: "10 bet — ajoyib boshlanish. Qaysi kitob? Men ham bir tavsiya qilmoqchiman aslida.",
    instagram: "Aytmoqchi, men ham shu balodaman. Birga shartlashamiz — peshindan oldin Instagram yo'q. Kim bo'lsa, qahva to'laydi.",
    niyat: "Niyat qilding — zo'r! Aytadigan bo'lsam, men ham har ertalab niyat qilaman. Bu odat bo'lib ketgan.",
    parents: "Brat, men sen bilan rost gaplashayotgan bo'lsam, onamga bugun qo'ng'iroq qilmadim hali. Birga qilamizmi? Sen o'zingnikiga, men o'zimnikiga.",
    sabr: "Yo, qiyin paytlar bo'ladi-da. Men ham o'tdim shundayini. Asosiy gap — yolg'iz qolma. Birovga ayt, bo'shashib qol.",
    feeling: "Brat, ayt nima bo'lyapti? Charchadingmi? Achchiqlanibsanmi? Men quloq solyapman, tinglayman.",
    thanks: "Hech narsa-yu, brat! Sen ham menga yordam berasan bir kun.",
    default: "Demo rejimida-da, brat. Real AI uchun .env'ga kalit qo'sh, undan keyin to'liq gaplashamiz.",
  },
  sport_coach: {
    greet: "Salom champion! Bugun PR (personal record) ni urib chiqamizmi?",
    identity: "Men Niyat — sening mental coach'ing. Hozir warm-up rejimda (demo). Asosiy training (real AI) uchun kalit qo'shilsa, to'liq quvvatda ishlayman!",
    quran: "Qur'on — bu mentol GYM. Streak hozir necha kun? 0 dan boshlasak, ertaga 1, indinga 2. Tushundim — hozir 5 daqiqa!",
    sport: "ZO'R! Bugungi target: 30 daqiqa kardio + 20 daqiqa kuch. Yozib ber natijani — har hafta progress!",
    book: "Maqsad — kuniga 10 bet. Haftada 70 bet. Oyiga 280 bet = 1 kitob. Trekka qo'yamiz!",
    instagram: "Ekran vaqti — bu sening dushman. Hisobla: kuniga 2 soat = haftada 14 soat = oyiga 60 soat. Shu vaqtni sportga al!",
    niyat: "Niyat — sening goal! Aniq raqam ber. Qachongacha? Qancha? Vaqti? Bularsiz — niyat emas, orzu.",
    parents: "Family bonding — bu ham score! Onaga qo'ng'iroq = +10 ball. Otaga = +10. Haftada 70+ ball maqsad qil.",
    sabr: "Sabr — bu plateau. Treninging davom etayotgan vaqt — natija ko'rinmasa ham, mushaklar o'sayotgan paytda. Push through!",
    feeling: "Stats ber: 1-10 shkalada qancha energiya? 1-10 motivation? Aniq raqam ayt, plan tuzamiz.",
    thanks: "Yes! Mutual support — bu ham PR! Yana kelaver, har hafta progress.",
    default: "Demo mode — limited reps. Full training (real AI) uchun .env'ga OPENAI_API_KEY qo'sh va run qil!",
  },
};

export function mockReply(userText: string, personality: AIPersonalityKey = "balanced"): string {
  const t = userText.toLowerCase().trim();
  const set = MOCK_BY_PERSONALITY[personality] ?? MOCK_BY_PERSONALITY.balanced;

  // Salomlashish
  if (/^(salom|assalom|vasalom|hi|hello|hey|hayrli)/i.test(t)) return set.greet;
  // Identity savollar
  if (
    /\b(kim sen|sen kim|kimsan|seni kim|sen nima|kim yaratgan|kim yasagan|yasaganmi|yaratganmi|kim qildi|kim qurgan|qaysi ai|chatgpt|claude|gpt|api|ish lab|ishlamayapti|kalit|key)\b/.test(
      t,
    )
  ) {
    return set.identity;
  }
  // Mavzuga oid
  if (/(qur'on|quron|qur on|tilovat|oyat|sura)/.test(t)) return set.quran;
  if (/(sport|yurish|gym|fitness|trening|kardio)/.test(t)) return set.sport;
  if (/(kitob|o'qish|oqish|mutoala)/.test(t)) return set.book;
  if (/(instagram|tiktok|telegram|youtube|ijtimoiy|social|ekran)/.test(t)) return set.instagram;
  if (/\bniyat/.test(t)) return set.niyat;
  if (/(ona|ota|onam|otam|qarindosh|oila|opa|aka|uka)/.test(t)) return set.parents;
  if (/(sabr|sabrli|qiyin|og'ir|charchadim|tushgan|tushaman)/.test(t)) return set.sabr;
  if (/(his|tuyg'u|tuygu|kayfiyat|asabiy|hafa|xursand|hursand)/.test(t)) return set.feeling;
  if (/(rahmat|tashakkur|minnatdor)/.test(t)) return set.thanks;

  return set.default;
}

async function callStreamingAPI(
  args: SendArgs,
): Promise<SendResult> {
  const messages = [
    ...args.history.map((m) => ({
      role: m.from === "coach" ? ("assistant" as const) : ("user" as const),
      content: m.text,
    })),
    { role: "user" as const, content: args.userText },
  ];

  try {
    // Mobile (Capacitor) ichida ekan, absolute URL ishlatamiz; web'da relativ.
    const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    const res = await fetch(`${apiBase}/api/coach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages,
        userContext: args.userContext,
        personality: args.personality,
        stream: true,
      }),
    });

    if (!res.ok) {
      if (res.status === 503) {
        // API key sozlanmagan — mock
        const text = mockReply(args.userText, args.personality ?? "balanced");
        // Mock'da ham progressivlik berib turamiz — chat tirikday ko'rinadi.
        if (args.onDelta) {
          for (let i = 0; i < text.length; i += 3) {
            await new Promise((r) => setTimeout(r, 24));
            args.onDelta(text.slice(0, i + 3));
          }
        }
        return { reply: text, usingRealAI: false };
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No reader");
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE lineswise parsing
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let evt: { type?: string; text?: string; error?: string };
        try {
          evt = JSON.parse(line.slice(6));
        } catch {
          continue; // line parse error — skip
        }
        if (evt.type === "delta" && typeof evt.text === "string") {
          full += evt.text;
          args.onDelta?.(full);
        } else if (evt.type === "error") {
          throw new Error(evt.error ?? "stream-error");
        }
      }
    }

    if (!full) {
      // Provider hech narsa yubormadi (masalan, Gemini safety filter bloklab tashladi)
      throw new Error("AI bo'sh javob qaytardi");
    }
    return { reply: full, usingRealAI: true };
  } catch (err) {
    console.warn("[useCoach] fallback to mock:", err);
    const text = mockReply(args.userText, args.personality ?? "balanced");
    if (args.onDelta) {
      for (let i = 0; i < text.length; i += 3) {
        await new Promise((r) => setTimeout(r, 24));
        args.onDelta(text.slice(0, i + 3));
      }
    }
    return { reply: text, usingRealAI: false };
  }
}

export function useCoach() {
  const [isPending, setIsPending] = useState(false);

  const send = useCallback(async (args: SendArgs): Promise<SendResult> => {
    setIsPending(true);
    try {
      return await callStreamingAPI(args);
    } finally {
      setIsPending(false);
    }
  }, []);

  return { send, isPending };
}
