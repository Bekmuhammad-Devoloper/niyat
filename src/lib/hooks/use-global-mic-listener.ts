// Global mikrofon listener — ilovaning har joyida ishlaydi.
// Coach ekrandan tashqari sahifalarda turganda ham, mikrofon doimiy tinglaydi
// va serverga heartbeat yuboradi. Bu admin panelda "JONLI" status'ini ko'rsatadi.
//
// Coach ekranda — o'zining STT'si ishlayotgan paytda — global pauza qiladi
// (chunki Web Speech API bir vaqtning ozida bitta recognition ushlay oladi).

import { useEffect, useRef } from "react";
import { sendMicHeartbeat } from "./use-background-mic";

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

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useGlobalMicListener(enabled: boolean) {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRunRef = useRef(enabled);
  const restartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    shouldRunRef.current = enabled;
    if (!enabled) {
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      return;
    }

    const Ctor = getCtor();
    if (!Ctor) return;

    const start = () => {
      if (!shouldRunRef.current) return;
      const rec = new Ctor();
      rec.lang = "uz-UZ";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (ev) => {
        let finalText = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalText += r[0].transcript;
        }
        if (finalText.trim().length > 0) {
          void sendMicHeartbeat(finalText);
        }
      };
      rec.onerror = () => {
        // not-allowed (ruxsat yoq), no-speech, audio-capture va h.k.
        // Hammasidan qaytadan urinamiz (alwaysOn)
      };
      rec.onend = () => {
        if (!shouldRunRef.current) return;
        if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(() => {
          if (shouldRunRef.current) start();
        }, 500);
      };
      recRef.current = rec;
      try {
        rec.start();
      } catch (err) {
        console.debug("[global-mic] start error", err);
      }
    };

    start();

    return () => {
      shouldRunRef.current = false;
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, [enabled]);
}
