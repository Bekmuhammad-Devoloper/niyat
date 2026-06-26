// Niyat ovozli muloqot rejimi — hands-free voice conversation pipeline.
//
// MVP 2 v2: Web Speech API ni tashlab, MediaRecorder + OpenAI Whisper
// (server tomoni /api/stt) bilan ishlaymiz. Web Speech Capacitor WebView'da
// ishonchli emas — Whisper esa har qanday qurilmada to'g'ri ishlaydi.
//
// Oqim:
//   1. idle      — boshlash kutyapti
//   2. listening — mikrofon yoniq, jim, foydalanuvchi gapirishini kutyapti
//   3. recording  — audio yozilyapti, foydalanuvchi gapiryapti
//   4. processing — Whisper transkripsiya + AI javob kutilmoqda
//   5. speaking   — AI javobi TTS bilan ovozli o'qilmoqda
//   6. listening qaytadan (hands-free loop)

import { useCallback, useEffect, useRef, useState } from "react";
import { useCoach } from "./use-coach";
import { useCoachTTS } from "./use-coach-tts";
import { useUserProfile } from "./use-user-profile";
import { useWhisperStt } from "./use-whisper-stt";
import { executePhoneCommands } from "@/lib/phone-control";
import type { CoachMessage } from "@/lib/niyat-data";

export type VoiceState =
  | "idle"
  | "listening"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

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
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  // Holatlarni state-machine'da tinglash uchun
  const stateRef = useRef<VoiceState>("idle");
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Boshlang'ich salomlashish bo'lganmi?
  const greetedRef = useRef(false);

  // AI'ga yuborish + TTS bilan o'qish + commands bajarish
  const sendToAI = useCallback(
    async (text: string) => {
      if (
        stateRef.current === "processing" ||
        stateRef.current === "speaking"
      ) {
        return;
      }
      setErrorMsg(null);
      setState("processing");
      setAiResponse("");
      setUserTranscript(text);

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
        const { cleanText, executed } = await executePhoneCommands(result.reply);
        if (executed.length > 0) {
          console.log("[niyat-voice] commands executed:", executed);
        }

        // TTS — yumshoq ayol ovozi
        setState("speaking");
        try {
          await tts.speak(cleanText, "shimmer", "default");
        } catch (err) {
          console.warn("[niyat-voice] TTS failed", err);
        }

        // TTS tugagach — qayta listening
        setUserTranscript("");
        if (active) {
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
    [active, coach, messages, profile.firstName, tts],
  );

  // Whisper STT hookini ulash — faqat AI gapirmayotgan paytda faol
  const sttActive =
    active && state !== "processing" && state !== "speaking" && state !== "error";

  const stt = useWhisperStt({
    active: sttActive,
    onAudioLevel: setAudioLevel,
    onTranscript: (text) => {
      if (!text.trim()) return;
      void sendToAI(text.trim());
    },
    onError: (msg) => setErrorMsg(msg),
  });

  // STT holatini bizning VoiceState'ga moslash
  useEffect(() => {
    if (!active) return;
    if (stateRef.current === "processing" || stateRef.current === "speaking") {
      return; // o'z holatimiz ustun
    }
    if (stt.state === "recording") setState("recording");
    else if (stt.state === "listening") setState("listening");
    else if (stt.state === "transcribing") setState("processing");
    else if (stt.state === "error") {
      setState("error");
      if (stt.error) setErrorMsg(stt.error);
    } else if (stt.state === "requesting") setState("listening");
  }, [stt.state, stt.error, active]);

  // active o'zgarganda — boshlash/to'xtatish
  useEffect(() => {
    if (active) {
      setUserTranscript("");
      setAiResponse("");
      setErrorMsg(null);

      // Birinchi marta ochilganda iliq salom
      if (!greetedRef.current) {
        greetedRef.current = true;
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
        void tts
          .speak(greeting, "shimmer", "default")
          .catch(() => undefined)
          .finally(() => {
            if (active) setState("listening");
            else setState("idle");
          });
      }
    } else {
      tts.stop();
      greetedRef.current = false;
      setMessages([]);
      setState("idle");
      setUserTranscript("");
    }
    // ataylab tts/profile deps emas — infinite loop'dan saqlanish uchun
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Tashqaridan to'xtatish
  const interrupt = useCallback(() => {
    tts.stop();
    stt.interrupt();
    setUserTranscript("");
    setAiResponse("");
    if (active) setState("listening");
  }, [active, stt, tts]);

  return {
    state,
    userTranscript,
    aiResponse,
    error: errorMsg,
    audioLevel,
    messages,
    interrupt,
    sttSupported: true,
    sttError: stt.error,
    activeLang: "uz (Whisper)",
  };
}

function greetingFor(firstName: string): string {
  const name = firstName && firstName !== "do'st" ? firstName : "uka";
  const options = [
    `${name}, assalomu alaykum. Tinglayapman, qanaqa yordam kerak?`,
    `${name}, salom. Eshityapman seni, gapir.`,
    `Salom ${name}, qalaysan? Bugun nima xayolingda?`,
  ];
  // Date.now ishlatish kerak emas — har ochilganda navbatma-navbat
  return options[Math.floor(Math.random() * options.length)];
}
