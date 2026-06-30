// Niyat ovozli muloqot rejimi — tap-to-talk pipeline.
//
// MVP 2 v3: WebView'ning getUserMedia/MediaRecorder muammosini chetlab
// o'tish uchun native AudioCapturePlugin'dan foydalanamiz. Foydalanuvchi
// yozish tugmasini bosib gapiradi, qaytadan bosib to'xtatadi — keyin
// Whisper transkripsiya, AI javob, TTS o'qish.
//
// State machine:
//   idle        — boshlash kutyapti
//   recording   — yozayapti (mic tugma bosilgan)
//   processing  — Whisper + AI javob
//   speaking    — TTS ijro
//   error       — xato

import { useCallback, useEffect, useRef, useState } from "react";
import { useCoach } from "./use-coach";
import { useCoachTTS } from "./use-coach-tts";
import { useUserProfile } from "./use-user-profile";
import { useNativeStt } from "./use-native-stt";
import { executePhoneCommands } from "@/lib/phone-control";
import type { CoachMessage } from "@/lib/niyat-data";

export type VoiceState =
  | "idle"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

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
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  const greetedRef = useRef(false);
  const messagesRef = useRef<CoachMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // AI'ga yuborish + commands + TTS
  const sendToAI = useCallback(
    async (text: string) => {
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
          history: messagesRef.current,
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

        const { cleanText, executed } = await executePhoneCommands(result.reply);
        if (executed.length > 0) {
          console.log("[niyat-voice] commands executed:", executed);
        }

        setState("speaking");
        try {
          await tts.speak(cleanText, "coral", "default");
        } catch (err) {
          console.warn("[niyat-voice] TTS failed", err);
        }
        setUserTranscript("");
        setState("idle");
      } catch (err) {
        console.error("[niyat-voice] coach failed", err);
        setErrorMsg(
          err instanceof Error ? err.message : "AI bilan bog'lanib bo'lmadi",
        );
        setState("error");
      }
    },
    [coach, profile.firstName, tts],
  );

  // Native STT — tap to start/stop
  const stt = useNativeStt({
    onTranscript: (text) => {
      if (!text.trim()) return;
      void sendToAI(text.trim());
    },
    onError: (msg) => {
      setErrorMsg(msg);
      setState("error");
    },
  });

  // STT holatini Voice state'ga moslash
  useEffect(() => {
    if (!active) return;
    if (state === "processing" || state === "speaking") return;
    if (stt.state === "recording") setState("recording");
    else if (stt.state === "transcribing") setState("processing");
    else if (stt.state === "error") setState("error");
    else if (stt.state === "idle" && state === "recording") setState("idle");
  }, [stt.state, active, state]);

  // active o'zgarganda — salomlashish va cleanup
  useEffect(() => {
    if (active) {
      setUserTranscript("");
      setAiResponse("");
      setErrorMsg(null);

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
          .speak(greeting, "coral", "default")
          .catch(() => undefined)
          .finally(() => {
            setState("idle");
          });
      }
    } else {
      tts.stop();
      void stt.cancel();
      greetedRef.current = false;
      setMessages([]);
      setState("idle");
      setUserTranscript("");
      setAiResponse("");
    }
    // ataylab tts/stt/profile deps emas — loop xavfi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Tap to start/stop recording
  const toggleRecording = useCallback(async () => {
    if (state === "processing" || state === "speaking") {
      // AI gapirayotgan paytda foydalanuvchi gapirsa — to'xtatamiz
      tts.stop();
    }
    await stt.toggle();
  }, [state, stt, tts]);

  return {
    state,
    userTranscript,
    aiResponse,
    error: errorMsg,
    messages,
    toggleRecording,
    isRecording: state === "recording",
    isTranscribing: state === "processing",
    sttError: stt.error,
  };
}

function greetingFor(firstName: string): string {
  const name = firstName && firstName !== "do'st" ? firstName : "uka";
  const options = [
    `${name}, assalomu alaykum. Tugmani bosib gapir, qaytadan bosib yubor.`,
    `${name}, salom. Mikrofonni bosib gapiringiz, men eshityapman.`,
    `Salom ${name}. Qanaqa yordam kerak? Mikrofon tugmasini bosing.`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}
