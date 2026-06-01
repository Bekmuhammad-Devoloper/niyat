import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API turlarini deklaratsiya qilamiz — TS standartida yo'q.
type SpeechRecognitionLike = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
    length: number;
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ====== STT (Speech to Text) ======
// O'zbek tilini ko'p brauzerlar qo'llamaydi (uz-UZ). Shu sabab fallback
// ketma-ketlik: uz-UZ → ru-RU → en-US. Xato bo'lsa avtomatik keyingisiga
// o'tadi va foydalanuvchiga bildiradi.
const LANG_FALLBACK_CHAIN = ["uz-UZ", "ru-RU", "en-US"];

export function useSpeechRecognition(opts: {
  lang?: string;
  onResult?: (text: string, isFinal: boolean) => void;
  // alwaysOn: tinglash to'xtaganda avtomatik qayta boshlash.
  // Coach ekrani ochiq turganda mikrofon doimiy yoniq turishi uchun.
  alwaysOn?: boolean;
  // muted: true bo'lsa, auto-restart vaqtinchalik to'xtaydi (masalan TTS gapirayotgan paytda
  // mikrofon o'z ovozini eshitmasligi uchun).
  muted?: boolean;
} = {}) {
  const { lang = "uz-UZ", onResult, alwaysOn = false, muted = false } = opts;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState(lang);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  const fallbackIdxRef = useRef(0);
  const alwaysOnRef = useRef(alwaysOn);
  const mutedRef = useRef(muted);
  const restartTimerRef = useRef<number | null>(null);
  const manuallyStoppedRef = useRef(false);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    alwaysOnRef.current = alwaysOn;
  }, [alwaysOn]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const supported = !!getRecognitionCtor();

  const startWithLang = useCallback(
    (langCode: string) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setError("Brauzer Web Speech API'ni qo'llab-quvvatlamaydi");
        return false;
      }
      const rec = new Ctor();
      rec.lang = langCode;
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (ev) => {
        let finalText = "";
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        const current = finalText || interim;
        setTranscript(current);
        onResultRef.current?.(current, !!finalText);
      };
      rec.onerror = (ev) => {
        const errEv = ev as Event & { error?: string };
        const errType = errEv.error ?? "speech-error";
        // Til qo'llab-quvvatlanmasa — keyingi til'ga o'tamiz
        if (
          (errType === "language-not-supported" || errType === "not-allowed-language") &&
          fallbackIdxRef.current + 1 < LANG_FALLBACK_CHAIN.length
        ) {
          fallbackIdxRef.current++;
          const nextLang = LANG_FALLBACK_CHAIN[fallbackIdxRef.current];
          setActiveLang(nextLang);
          startWithLang(nextLang);
          return;
        }
        // not-allowed va audio-capture — qaytarib bo'lmaydigan xatolar
        if (errType === "not-allowed") {
          setError("Mikrofon ruxsati berilmadi. Brauzer sozlamalarida ruxsat bering.");
          manuallyStoppedRef.current = true; // restart qilmaymiz
        } else if (errType === "audio-capture") {
          setError("Mikrofon topilmadi yoki ishlamayapti.");
          manuallyStoppedRef.current = true;
        } else if (errType === "no-speech") {
          // alwaysOn rejimda — bu xato emas, normal pauza. Jim'cha qaytadan ishga tushiramiz.
          if (!alwaysOnRef.current) setError("Ovoz eshitilmadi. Yana urinib ko'ring.");
        } else {
          setError(`Xato: ${errType}`);
        }
        setIsListening(false);
      };
      rec.onend = () => {
        setIsListening(false);
        // Auto-restart: alwaysOn yoqilgan va foydalanuvchi o'zi to'xtatmagan va
        // muted emas (TTS gapirmayapti)
        if (
          alwaysOnRef.current &&
          !manuallyStoppedRef.current &&
          !mutedRef.current
        ) {
          if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
          // Kichik kechikish — brauzer recognition'ni to'liq tozalash uchun
          restartTimerRef.current = window.setTimeout(() => {
            if (
              alwaysOnRef.current &&
              !manuallyStoppedRef.current &&
              !mutedRef.current
            ) {
              startWithLang(LANG_FALLBACK_CHAIN[fallbackIdxRef.current] ?? lang);
            }
          }, 300);
        }
      };
      recRef.current = rec;
      setError(null);
      setIsListening(true);
      try {
        rec.start();
        return true;
      } catch (err) {
        console.error(err);
        setIsListening(false);
        return false;
      }
    },
    [],
  );

  const start = useCallback(() => {
    // Birinchi marta: kerakli tildan boshlash, fallback chain qaytadan
    const startLang = lang ?? LANG_FALLBACK_CHAIN[0];
    fallbackIdxRef.current = LANG_FALLBACK_CHAIN.indexOf(startLang);
    if (fallbackIdxRef.current < 0) fallbackIdxRef.current = 0;
    manuallyStoppedRef.current = false;
    setActiveLang(startLang);
    setTranscript("");
    setError(null);
    startWithLang(startLang);
  }, [lang, startWithLang]);

  const stop = useCallback(() => {
    manuallyStoppedRef.current = true;
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recRef.current?.stop();
    setIsListening(false);
  }, []);

  // alwaysOn dinamik o'zgarsa — ekran ochilganda yoqilsa avtomatik boshlash
  useEffect(() => {
    if (!alwaysOn) return;
    if (!supported) return;
    if (isListening) return;
    if (muted) return;
    if (manuallyStoppedRef.current) return;
    // Birinchi marta yoqilganda — start
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysOn, muted, supported]);

  useEffect(
    () => () => {
      manuallyStoppedRef.current = true;
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      recRef.current?.abort();
    },
    [],
  );

  return { supported, isListening, transcript, error, activeLang, start, stop };
}

// ====== TTS (Text to Speech) ======
// Til ovozi mavjud bo'lmaganda fallback zanjiri.
// O'zbekcha → Turkcha (fonetik eng yaqin) → Ruscha → Inglizcha
const TTS_LANG_FALLBACKS: Record<string, string[]> = {
  uz: ["uz", "tr", "ru", "en"], // Turkcha o'zbekchaga fonetik yaqin
  tr: ["tr", "en"],
  ru: ["ru", "en"],
  en: ["en"],
  ar: ["ar", "en"],
};

// Berilgan til kodi va voices ro'yxati uchun eng yaxshi ovozni tanlash.
// Qaytaradi: { voice, usedLang } — qaysi til ovozi haqiqatan tanlandi
function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  desiredLang: string,
): { voice: SpeechSynthesisVoice | null; usedLang: string } {
  const prefix = desiredLang.slice(0, 2).toLowerCase();
  const chain = TTS_LANG_FALLBACKS[prefix] ?? [prefix, "en"];

  // 1. Aynan mos kelgan til kodi (uz-UZ === uz-UZ)
  const exact = voices.find((v) => v.lang.toLowerCase() === desiredLang.toLowerCase());
  if (exact) return { voice: exact, usedLang: exact.lang };

  // 2. Fallback zanjiri bo'yicha qidirish (uz → tr → ru → en)
  for (const langPrefix of chain) {
    const v = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (v) return { voice: v, usedLang: v.lang };
  }

  // 3. Hech narsa topilmasa — birinchi mavjud ovoz
  return { voice: voices[0] ?? null, usedLang: voices[0]?.lang ?? "" };
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lastUsedLang, setLastUsedLang] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const speak = useCallback(
    (text: string, options: { lang?: string; rate?: number; pitch?: number } = {}) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const desiredLang = options.lang ?? "uz-UZ";
      utter.rate = options.rate ?? 1.0;
      utter.pitch = options.pitch ?? 1.0;

      const { voice, usedLang } = pickBestVoice(voices, desiredLang);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
        setLastUsedLang(usedLang);
      } else {
        utter.lang = desiredLang;
      }

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [supported, voices],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supported]);

  // Berilgan til mavjudligini tekshirish
  const hasNativeVoice = useCallback(
    (lang: string): boolean => {
      const prefix = lang.slice(0, 2).toLowerCase();
      return voices.some((v) => v.lang.toLowerCase().startsWith(prefix));
    },
    [voices],
  );

  return { supported, isSpeaking, voices, lastUsedLang, hasNativeVoice, speak, stop };
}
