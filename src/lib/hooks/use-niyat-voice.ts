// Niyat ovozli muloqot rejimi — hands-free voice conversation pipeline.
//
// Oqim:
//   1. idle      — boshlash kutyapti
//   2. listening — mikrofon yoniq, foydalanuvchi gapiryapti
//   3. processing — silence detected, AI'ga yuborildi, javob kutilmoqda
//   4. speaking   — AI javobi TTS bilan ovozli o'qilmoqda
//   5. idle yoki listening (loopMode true bo'lsa — qayta listening'ga qaytadi)

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "./use-speech";
import { useCoach } from "./use-coach";
import { useCoachTTS } from "./use-coach-tts";
import { useUserProfile } from "./use-user-profile";
import { executePhoneCommands } from "@/lib/phone-control";
import type { CoachMessage } from "@/lib/niyat-data";

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

// Foydalanuvchi gapirib tugatganini aniqlash — silence (tinch) muddati.
// Web Speech API o'zining tugashini emas, isFinal eventini chaqiradi, lekin
// alwaysOn rejimida foydalanuvchi pauza qilganda ham auto-yuboramiz.
const SILENCE_DELAY_MS = 1500;

// Voice mode'da default samimiy "yaqin do'st" personality
const VOICE_PERSONALITY = "friend" as const;

export function useNiyatVoice(opts: { active: boolean }) {
  const { active } = opts;
  const { profile } = useUserProfile();
  const coach = useCoach();
  const tts = useCoachTTS();

  const [state, setState] = useState<VoiceState>("idle");
  const [userTranscript, setUserTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Ovozli muloqotga maxsus mahalliy tarix — coach sessions bilan birga,
  // lekin har bir voice mode boshlanganda yangi boshlanadi (kontekst toza)
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  const silenceTimerRef = useRef<number | null>(null);
  const lastTranscriptRef = useRef("");
  // Yangi foydalanuvchi gap boshlaganda eski AI javobni tozalash uchun
  const isSpeakingRef = useRef(false);

  const stt = useSpeechRecognition({
    lang: "uz-UZ",
    alwaysOn: active,
    muted: !active || state === "speaking" || state === "processing",
    onResult: (text, isFinal) => {
      if (!text.trim()) return;
      setUserTranscript(text);
      lastTranscriptRef.current = text;

      // Foydalanuvchi gap boshladi — agar AI gapirayotgan bo'lsa, to'xtatamiz
      if (isSpeakingRef.current) {
        tts.stop();
        isSpeakingRef.current = false;
      }

      // Silence taymerni qayta tiklash — foydalanuvchi gapiryapti
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
      // Final natija yoki interim ham — biroz kuting va yuboring
      const delay = isFinal ? 600 : SILENCE_DELAY_MS;
      silenceTimerRef.current = window.setTimeout(() => {
        const finalText = lastTranscriptRef.current.trim();
        if (finalText.length > 0) {
          void sendToAI(finalText);
        }
      }, delay);
    },
  });

  // AI'ga yuborish + TTS bilan o'qish + commands bajarish
  const sendToAI = useCallback(
    async (text: string) => {
      if (state === "processing" || state === "speaking") return;
      setErrorMsg(null);
      setState("processing");
      setAiResponse("");

      const userMsg: CoachMessage = {
        id: `voice-u-${Date.now()}`,
        from: "user",
        text,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const result = await coach.send({
          history: messages,
          userText: text,
          userContext: { firstName: profile.firstName },
          // Voice mode'da har doim "yaqin do'st" ohangi — settings'dan qat'i nazar.
          // Foydalanuvchi xohlasa keyinroq override qilamiz.
          personality: VOICE_PERSONALITY,
          onDelta: (partial) => setAiResponse(partial),
        });

        const aiMsg: CoachMessage = {
          id: `voice-a-${Date.now()}`,
          from: "coach",
          text: result.reply,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setAiResponse(result.reply);

        // Telefon boshqaruv buyruqlarini ajratib bajarib, gapdan tozalaymiz
        const { cleanText, executed } = await executePhoneCommands(
          result.reply,
        );
        if (executed.length > 0) {
          console.log("[niyat-voice] commands executed:", executed);
        }

        // TTS — yumshoq ayol ovozi
        setState("speaking");
        isSpeakingRef.current = true;
        try {
          await tts.speak(cleanText, "shimmer", "default");
        } catch (err) {
          console.warn("[niyat-voice] TTS failed", err);
        }
        isSpeakingRef.current = false;

        // TTS tugagach — qaytadan listening'ga (hands-free loop)
        if (active) {
          setUserTranscript("");
          lastTranscriptRef.current = "";
          setState("listening");
        } else {
          setState("idle");
        }
      } catch (err) {
        console.error("[niyat-voice] coach failed", err);
        setErrorMsg(
          err instanceof Error ? err.message : "AI bilan bog'lanib bo'lmadi",
        );
        setState("error");
      }
    },
    [active, coach, messages, profile.firstName, tts, state],
  );

  // active o'zgarganda — STT ni boshlash/to'xtatish
  useEffect(() => {
    if (active) {
      setState("listening");
      setUserTranscript("");
      setAiResponse("");
      setErrorMsg(null);
      stt.start();
      // Salomlashish — birinchi marta ochilganda iliq salom
      if (messages.length === 0) {
        const greeting = greetingFor(profile.firstName);
        const aiMsg: CoachMessage = {
          id: `voice-greeting-${Date.now()}`,
          from: "coach",
          text: greeting,
          createdAt: Date.now(),
        };
        setMessages([aiMsg]);
        setAiResponse(greeting);
        setState("speaking");
        isSpeakingRef.current = true;
        void tts
          .speak(greeting, "shimmer", "default")
          .catch(() => undefined)
          .finally(() => {
            isSpeakingRef.current = false;
            if (active) setState("listening");
          });
      }
    } else {
      stt.stop();
      tts.stop();
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setState("idle");
      setUserTranscript("");
    }
    // stt va tts referenslari har render'da yangidan — ataylab deps emas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Tashqaridan yopish/qayta boshlash
  const interrupt = useCallback(() => {
    tts.stop();
    isSpeakingRef.current = false;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setUserTranscript("");
    setAiResponse("");
    lastTranscriptRef.current = "";
    if (active) setState("listening");
  }, [active, tts]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    userTranscript,
    aiResponse,
    error: errorMsg,
    messages,
    interrupt,
    sttSupported: stt.supported,
    sttError: stt.error,
    activeLang: stt.activeLang,
  };
}

function greetingFor(firstName: string): string {
  const name = firstName && firstName !== "do'st" ? firstName : "uka";
  const options = [
    `${name}, assalomu alaykum. Tinglayapman, qanaqa yordam kerak?`,
    `${name}, salom. Eshityapman seni, gapir.`,
    `Salom ${name}, qalaysan? Bugun nima xayolingda?`,
  ];
  return options[Math.floor(Date.now() / 1000) % options.length];
}
