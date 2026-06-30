// Native record + Whisper transkripsiya — Web getUserMedia muammosini
// chetlab o'tuvchi yo'l. Capacitor.isNativePlatform() bo'lsa AudioCapture
// native plugin'idan foydalanamiz, aks holda useWhisperStt (MediaRecorder)
// fallback.
//
// Foydalanish (tap-to-talk):
//   const stt = useNativeStt({ onTranscript });
//   stt.toggle(); // bossangiz boshlanadi, qaytadan bossangiz to'xtaydi va transkripsiya yuboriladi

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AudioCapture, base64ToBlob } from "@/lib/native/audio-capture";

export type NativeSttState =
  | "idle"
  | "recording"
  | "transcribing"
  | "error";

export function useNativeStt(opts: {
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
}) {
  const { onTranscript, onError } = opts;
  const [state, setState] = useState<NativeSttState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Web fallback uchun
  const webStreamRef = useRef<MediaStream | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  // Cleanup yopilganda
  const startedRef = useRef(false);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const apiBase =
          (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
        const fd = new FormData();
        fd.append("audio", blob, "audio.m4a");
        fd.append("lang", "uz");
        const res = await fetch(`${apiBase}/api/stt`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { text: string };
        const text = (data.text ?? "").trim();
        if (text) onTranscript(text);
        setState("idle");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transkripsiya xatosi";
        setErrorMsg(msg);
        onError?.(msg);
        setState("error");
      }
    },
    [onTranscript, onError],
  );

  const start = useCallback(async () => {
    if (startedRef.current) return;
    setErrorMsg(null);
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await AudioCapture.startRecording();
        if (!res.started) throw new Error("Native start failed");
      } else {
        // Web fallback — MediaRecorder
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Mikrofon bu brauzerda mavjud emas");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;
        webChunksRef.current = [];
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) webChunksRef.current.push(e.data);
        };
        rec.start(250);
        webRecorderRef.current = rec;
      }
      startedRef.current = true;
      setState("recording");
    } catch (err) {
      const e = err as Error & { name?: string; message?: string };
      let msg = e?.message ?? "Yozib bo'lmadi";
      if (e?.message === "mic_permission_denied" || e?.name === "NotAllowedError") {
        msg =
          "Mikrofon ruxsati berilmadi. Sozlamalar → Niyat → Ruxsatlar → Mikrofon → Allow.";
      } else if (
        e?.name === "NotReadableError" ||
        /could not start audio source/i.test(e?.message ?? "")
      ) {
        msg =
          "Mikrofon band. Boshqa ilovani yoping (Telegram qo'ng'iroq, Google Assistant) va qayta urining.";
      }
      setErrorMsg(msg);
      onError?.(msg);
      setState("error");
    }
  }, [onError]);

  const stop = useCallback(async () => {
    if (!startedRef.current) return;
    startedRef.current = false;
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await AudioCapture.stopRecording();
        if (!res.audioBase64 || res.byteLength < 200) {
          setState("idle");
          return;
        }
        const blob = base64ToBlob(res.audioBase64, res.mimeType);
        await transcribe(blob);
      } else {
        const rec = webRecorderRef.current;
        if (!rec || rec.state === "inactive") {
          setState("idle");
          return;
        }
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          try { rec.stop(); } catch { resolve(); }
        });
        // Stream'ni to'xtatish
        webStreamRef.current?.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
        webRecorderRef.current = null;
        const blob = new Blob(webChunksRef.current, {
          type: webChunksRef.current[0]?.type || "audio/webm",
        });
        webChunksRef.current = [];
        if (blob.size < 1500) {
          setState("idle");
          return;
        }
        await transcribe(blob);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Yozishni to'xtatib bo'lmadi";
      setErrorMsg(msg);
      onError?.(msg);
      setState("error");
    }
  }, [onError, transcribe]);

  const cancel = useCallback(async () => {
    startedRef.current = false;
    try {
      if (Capacitor.isNativePlatform()) {
        await AudioCapture.cancelRecording().catch(() => undefined);
      } else {
        const rec = webRecorderRef.current;
        if (rec && rec.state !== "inactive") {
          try { rec.stop(); } catch { /* ignore */ }
        }
        webStreamRef.current?.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
        webRecorderRef.current = null;
        webChunksRef.current = [];
      }
    } finally {
      setState("idle");
    }
  }, []);

  const toggle = useCallback(async () => {
    if (state === "recording") {
      await stop();
    } else if (state === "idle" || state === "error") {
      await start();
    }
  }, [state, start, stop]);

  // Unmount paytida cleanup
  useEffect(() => {
    return () => {
      if (startedRef.current) {
        void cancel();
      }
    };
  }, [cancel]);

  return {
    state,
    error: errorMsg,
    start,
    stop,
    cancel,
    toggle,
    isRecording: state === "recording",
    isTranscribing: state === "transcribing",
  };
}
