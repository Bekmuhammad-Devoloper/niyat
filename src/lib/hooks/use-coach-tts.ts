// OpenAI TTS bilan Murabbiy ovozini ijro etish.
// Browser Web Speech API o'rniga server orqali tabiiy ovoz keladi.
// Audio blob'lar memory'da cache qilinadi — bir matn faqat bir marta API'ga kiradi.

import { useCallback, useEffect, useRef, useState } from "react";

// In-memory cache — bir session davomida bir xil matn qayta yuborilmaydi.
// Key: matn + ovoz turi
const audioCache = new Map<string, string>(); // text → blob URL

// Cache'ni 50 ta yozuvda saqlash (~ 5-10 MB)
const MAX_CACHE_SIZE = 50;

function cacheKey(text: string, voice: string): string {
  return `${voice}::${text}`;
}

function setCached(key: string, url: string): void {
  if (audioCache.size >= MAX_CACHE_SIZE) {
    // Eng eski element'ni o'chirib, URL'ni revoke qilamiz
    const firstKey = audioCache.keys().next().value;
    if (firstKey) {
      const oldUrl = audioCache.get(firstKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      audioCache.delete(firstKey);
    }
  }
  audioCache.set(key, url);
}

export function useCoachTTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Komponent unmount paytida audio'ni to'xtatamiz
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const speak = useCallback(
    async (
      text: string,
      voice: string = "ash",
      mode: "default" | "reminder" = "default",
    ): Promise<void> => {
      const cleaned = text.trim();
      if (!cleaned) return;
      setError(null);

      // Avval cache'ni tekshir (mode ham kalitda)
      const key = `${mode}::${cacheKey(cleaned, voice)}`;
      let blobUrl = audioCache.get(key) ?? null;

      // Reminder mode'da biroz sekinroq — har so'z aniq, ona kabi yumshoq
      const speed = mode === "reminder" ? 0.92 : 1.0;

      // Cache'da yo'q — server'dan so'rab olamiz
      if (!blobUrl) {
        setIsLoading(true);
        try {
          const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
          const res = await fetch(`${apiBase}/api/tts`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: cleaned, voice, mode, speed }),
          });
          if (!res.ok) {
            const errBody = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(errBody.error ?? `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
          setCached(key, blobUrl);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "TTS xatosi";
          setError(msg);
          setIsLoading(false);
          throw err;
        }
        setIsLoading(false);
      }

      // Oldingi audio'ni to'xtatamiz
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Yangi audio
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      audio.addEventListener("play", () => setIsPlaying(true));
      audio.addEventListener("pause", () => setIsPlaying(false));
      audio.addEventListener("ended", () => setIsPlaying(false));
      audio.addEventListener("error", () => {
        setIsPlaying(false);
        setError("Audio'ni ijro qilib bo'lmadi");
      });
      try {
        await audio.play();
      } catch (err) {
        console.warn("[coach-tts] play failed", err);
        setError("Audio ruxsati kerak — ekranga bosing");
      }
    },
    [],
  );

  return { speak, stop, isLoading, isPlaying, error };
}
