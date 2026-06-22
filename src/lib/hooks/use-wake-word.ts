// Wake word "Niyat" — orqa fonda eshitiluvchi BackgroundMic plugin'idan
// "wakeWord" event'ini qabul qilib, ovozli muloqot rejimini avtomatik ochadi.
//
// Native (Android APK) — to'liq ishlaydi. BackgroundMic foreground service
// 24/7 mikrofonni eshitadi va "niyat" deyilganda broadcast yuboradi.
//
// Web — fallback: brauzerda useSpeechRecognition alwaysOn rejimida tinglaydi
// va transkriptdan "niyat" so'zini topadi. Faqat sahifa ochiq turganda
// ishlaydi.

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useSpeechRecognition } from "./use-speech";

type WakeWordEvent = { text: string; at: number };

// Wake word naqshlari — ko'p variant: lotin va kirilcha, qo'shimchasiz va
// qo'shimcha bilan, fonetik buzuqliklar bilan. "muniyat" kabi to'g'ri
// boshqa so'zlarda xato uyg'otmaslik uchun chap chegara qat'iy, lekin o'ng
// — yumshoqroq ("niyatim", "niyatga" ham OK).
const WAKE_PATTERNS = [
  // Lotin
  /(?:^|\s)(niyyat|niyat|neyat|neyyat|nyat|niyot|niayat|niat|naat|neat|nijat|nijot)\b/i,
  // Lotin — qo'shimcha bilan (niyatim, niyatga, niyaty)
  /(?:^|\s)(niyat|niyyat|niyot)\w{0,4}\b/i,
  // Kirilcha
  /(?:^|\s)(ниат|нийат|ниять|няат|нят|неат|нияти|нияту|нияты|ниджат)\b/iu,
  /(?:^|\s)(ниат|нийат|ниять)\w{0,4}\b/iu,
];

function isWakePhrase(text: string): boolean {
  if (!text) return false;
  const cleaned = ` ${text.toLowerCase().trim()}`;
  return WAKE_PATTERNS.some((re) => re.test(cleaned));
}

const COOLDOWN_MS = 4000;

export function useWakeWord(opts: {
  enabled: boolean;
  // Voice mode allaqachon ochiq bo'lsa — uyg'otishni ignor qilamiz
  voiceModeOpen: boolean;
  onWake: (source: "native" | "web", text: string) => void;
}) {
  const { enabled, voiceModeOpen, onWake } = opts;
  const lastWakeRef = useRef(0);

  // ====== NATIVE (Android APK) ======
  useEffect(() => {
    if (!enabled) return;
    if (!Capacitor.isNativePlatform()) return;
    if (voiceModeOpen) return;

    let removeListener: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const plugin = registerPlugin<{
          addListener: (
            event: "wakeWord",
            cb: (data: WakeWordEvent) => void,
          ) => Promise<{ remove: () => Promise<void> }>;
        }>("BackgroundMic");
        if (cancelled) return;
        const handle = await plugin.addListener("wakeWord", (data) => {
          const now = Date.now();
          if (now - lastWakeRef.current < COOLDOWN_MS) return;
          lastWakeRef.current = now;
          onWake("native", data?.text ?? "");
        });
        removeListener = handle;
      } catch (err) {
        console.warn("[wake-word] native listener failed", err);
      }
    })();

    return () => {
      cancelled = true;
      void removeListener?.remove();
    };
  }, [enabled, voiceModeOpen, onWake]);

  // ====== WEB fallback ======
  // BackgroundMic faqat APK'da bor. Web'da brauzerdan ovozni tinglaymiz
  // (faqat sahifa ochiq + foydalanuvchi ruxsat bergan bo'lsa).
  const webEnabled =
    enabled && !voiceModeOpen && !Capacitor.isNativePlatform();
  useSpeechRecognition({
    lang: "uz-UZ",
    alwaysOn: webEnabled,
    muted: !webEnabled,
    onResult: (text, isFinal) => {
      if (!webEnabled) return;
      if (!isWakePhrase(text)) return;
      const now = Date.now();
      if (now - lastWakeRef.current < COOLDOWN_MS) return;
      lastWakeRef.current = now;
      onWake("web", text);
      // isFinal bo'lmasa keyingi sikldagi takror match'larni ignore qilish
      // uchun lastWakeRef yetarli.
      void isFinal;
    },
  });
}
