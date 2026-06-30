// MediaRecorder + OpenAI Whisper bilan ovozni matnga aylantirish.
//
// Web Speech API Capacitor WebView'da ishonchli emas, shu sabab
// MediaRecorder bilan audio yozib, /api/stt'ga jo'natamiz va matn olamiz.
// Yozish silence detection bilan tugaydi (AnalyserNode RMS).

import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_THRESHOLD = 0.018; // 0-1, past = juda sezgir
const SILENCE_DURATION_MS = 1500; // shuncha tinch turish — yozish to'xtaydi
const MIN_SPEECH_DURATION_MS = 500; // qisqa shovqinlarni rad qilish
const MAX_SPEECH_DURATION_MS = 30_000; // xavfsizlik chegarasi

export type WhisperState =
  | "idle"
  | "requesting" // mikrofon ruxsati so'ralyapti
  | "listening" // tinglayapti, jim kutilmoqda
  | "recording" // gapirish boshlandi, yozyapti
  | "transcribing" // server'ga jo'natildi, javob kutilmoqda
  | "error";

export function useWhisperStt(opts: {
  active: boolean;
  // Tinch davomida (audio paydo bo'lguncha) chiqarib turish — orb pulse uchun
  onAudioLevel?: (rms: number) => void;
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
}) {
  const { active, onAudioLevel, onTranscript, onError } = opts;
  const [state, setState] = useState<WhisperState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechStartedAtRef = useRef<number>(0);
  const lastVoiceAtRef = useRef<number>(0);
  const isRecordingRef = useRef(false);

  // Yozishni boshlash — gapirish aniqlanganda
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || isRecordingRef.current) return;
    try {
      const mime = pickSupportedMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const duration = Date.now() - speechStartedAtRef.current;
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || "audio/webm",
        });
        chunksRef.current = [];
        isRecordingRef.current = false;
        if (duration < MIN_SPEECH_DURATION_MS || blob.size < 1500) {
          // Juda qisqa — jim qayta tinglashga qaytamiz
          setState("listening");
          return;
        }
        void transcribe(blob);
      };
      rec.start(250);
      recorderRef.current = rec;
      isRecordingRef.current = true;
      speechStartedAtRef.current = Date.now();
      lastVoiceAtRef.current = Date.now();
      setState("recording");
    } catch (err) {
      console.warn("[whisper-stt] start record failed", err);
      setState("error");
      setErrorMsg("Yozib bo'lmadi");
    }
  }, []);

  // Yozishni to'xtatish va transkripsiyaga yuborish
  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, []);

  // Audio'ni server'ga jo'natib matn olish
  const transcribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const apiBase =
          (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
        const fd = new FormData();
        fd.append("audio", blob, "audio.webm");
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
        setState("listening");
      } catch (err) {
        console.warn("[whisper-stt] transcribe failed", err);
        const msg = err instanceof Error ? err.message : "STT xato";
        setErrorMsg(msg);
        onError?.(msg);
        setState("listening"); // qaytadan urinish uchun listening'ga qaytamiz
      }
    },
    [onTranscript, onError],
  );

  // Audio darajasini doimiy o'qib, gapirish boshini va silence'ni aniqlash
  const tickAudio = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) {
      animFrameRef.current = requestAnimationFrame(tickAudio);
      return;
    }
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    onAudioLevel?.(rms);

    const now = Date.now();
    const isLoud = rms > SILENCE_THRESHOLD;
    if (isLoud) {
      lastVoiceAtRef.current = now;
      if (!isRecordingRef.current) startRecording();
    } else if (isRecordingRef.current) {
      const silentMs = now - lastVoiceAtRef.current;
      const totalMs = now - speechStartedAtRef.current;
      if (silentMs >= SILENCE_DURATION_MS || totalMs >= MAX_SPEECH_DURATION_MS) {
        stopRecording();
      }
    }

    animFrameRef.current = requestAnimationFrame(tickAudio);
  }, [onAudioLevel, startRecording, stopRecording]);

  // active o'zgarganda boshlash/to'xtatish
  useEffect(() => {
    let cancelled = false;

    // BackgroundMic.stop() chaqirilgan bo'lishi mumkin, lekin Android
    // SpeechRecognizer AudioRecord'ni darhol ozod qilmaydi (IPC orqali
    // ~100-300ms keyin). Shu sabab biroz kutamiz va xato bo'lsa qayta
    // urinamiz. "Could not start audio source" / NotReadableError esa
    // odatda shu race muammosi.
    const openMicStream = async (): Promise<MediaStream> => {
      const tryOpen = async (constraints: MediaStreamConstraints) => {
        return navigator.mediaDevices.getUserMedia(constraints);
      };
      // 1) Biroz kuting — BackgroundMic to'xtatish IPC tugashi uchun
      await new Promise<void>((r) => window.setTimeout(r, 350));
      // 2) Birinchi urinish — to'liq constraints bilan
      try {
        return await tryOpen({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        const e = err as Error & { name?: string };
        // 3) Mikrofon hali band — yana biroz kutib qayta urinamiz
        if (
          e?.name === "NotReadableError" ||
          /could not start audio source/i.test(e?.message ?? "")
        ) {
          await new Promise<void>((r) => window.setTimeout(r, 600));
          try {
            return await tryOpen({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
          } catch {
            // 4) Constraint'lar muammo bo'lishi mumkin — oddiy {audio:true} bilan
            return await tryOpen({ audio: true });
          }
        }
        // 5) Constraint xatolar — oddiy {audio:true} bilan urinib ko'ramiz
        if (e?.name === "OverconstrainedError") {
          return await tryOpen({ audio: true });
        }
        throw err;
      }
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("error");
        setErrorMsg("Mikrofon bu qurilmada qo'llanmaydi");
        return;
      }
      setState("requesting");
      setErrorMsg(null);
      try {
        const stream = await openMicStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;
        setState("listening");
        tickAudio();
      } catch (err) {
        console.warn("[whisper-stt] getUserMedia failed", err);
        setState("error");
        const msg =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Mikrofon ruxsati berilmadi"
            : err instanceof Error
              ? err.message
              : "Mikrofon ochilmadi";
        setErrorMsg(msg);
        onError?.(msg);
      }
    };

    const stop = () => {
      cancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
      recorderRef.current = null;
      isRecordingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      setState("idle");
    };

    if (active) {
      void start();
    } else {
      stop();
    }

    return () => {
      stop();
    };
    // tickAudio referensi har render'da — ataylab deps emas (loop'ga olib kelmaslik uchun)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return {
    state,
    error: errorMsg,
    // Tashqaridan to'xtatish — yopiq ekranga o'tganda
    interrupt: useCallback(() => {
      if (isRecordingRef.current) stopRecording();
    }, [stopRecording]),
  };
}

function pickSupportedMime(): string | null {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    try {
      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported?.(c)
      ) {
        return c;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}
