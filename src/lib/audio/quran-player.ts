// Global audio player — Qur'on tilovati va Azon uchun umumiy.
//
// Modul darajasidagi singleton — React Tree tashqarisida yashaydi. Shuning
// uchun foydalanuvchi sheet'ni yopgan yoki boshqa ekranga o'tgan paytda
// ham audio davom etadi. Faqat o'zining "Stop" tugmasi yoki yangi audio
// boshlanganida to'xtaydi.
//
// MediaSession API qo'llab-quvvatlanadi — telefon blok ekranida sarlavha,
// va Play/Pause tugmalari ko'rinadi.

import { useEffect, useState } from "react";

export type AudioKind = "quran" | "adhan";

export type PlayingSurah = {
  kind?: AudioKind; // backwards-compat — bo'sh bo'lsa "quran"
  number: number;
  arabic: string;
  latin: string;
  reciterName: string;
  loop?: boolean;
};

let audioEl: HTMLAudioElement | null = null;
let currentSurah: PlayingSurah | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.preload = "none";
  audioEl.addEventListener("play", notify);
  audioEl.addEventListener("pause", notify);
  audioEl.addEventListener("ended", () => {
    currentSurah = null;
    notify();
  });
  audioEl.addEventListener("loadedmetadata", notify);
  audioEl.addEventListener("timeupdate", notify);
  return audioEl;
}

function setupMediaSession(surah: PlayingSurah): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${surah.latin} · ${surah.arabic}`,
      artist: surah.reciterName,
      album: "Qur'oni Karim · Niyat",
      artwork: [
        {
          src: "/yuksalish.logo.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      audioEl?.play().catch(() => undefined);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioEl?.pause();
    });
    navigator.mediaSession.setActionHandler("stop", () => {
      stopQuranAudio();
    });
    // Oldinga/orqaga 15 soniya (qisman qo'llab-quvvatlanadi)
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const skip = details.seekOffset ?? 15;
      if (audioEl) audioEl.currentTime = Math.min(audioEl.currentTime + skip, audioEl.duration || 0);
    });
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const skip = details.seekOffset ?? 15;
      if (audioEl) audioEl.currentTime = Math.max(audioEl.currentTime - skip, 0);
    });
  } catch (err) {
    console.warn("[quran-player] MediaSession setup failed", err);
  }
}

export function playQuranAudio(url: string, surah: PlayingSurah): void {
  const a = ensureAudio();
  if (!a) return;
  // Yangi sura — manba almashtirilsin
  if (a.src !== url) {
    a.src = url;
    a.loop = surah.loop === true;
    currentSurah = surah;
    setupMediaSession(surah);
  }
  a.play().catch((err) => {
    console.warn("[quran-player] play failed", err);
  });
  notify();
}

// Azon ijro qilish — namoz vaqti kelganda chaqiriladi.
// Default: bir marta ijro (oxirigacha o'qiydi). loop=true desangiz — siz
// to'xtatmaguncha takrorlaydi.
export function playAdhanAudio(
  url: string,
  prayerName: string = "Azon",
  loop: boolean = false,
): void {
  if (!url) {
    console.warn("[adhan] URL bo'sh — sozlamalarda kiriting");
    return;
  }
  playQuranAudio(url, {
    kind: "adhan",
    number: 0,
    arabic: "أذان",
    latin: prayerName,
    reciterName: "Azon",
    loop,
  });
}

export function pauseQuranAudio(): void {
  audioEl?.pause();
}

export function resumeQuranAudio(): void {
  audioEl?.play().catch(() => undefined);
}

export function stopQuranAudio(): void {
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
  currentSurah = null;
  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = null;
    } catch {
      /* ignore */
    }
  }
  notify();
}

// React komponentlari uchun reaktiv hook
export function useQuranPlayer() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const isPlaying = !!audioEl && !audioEl.paused;
  const isLoaded = !!audioEl && audioEl.readyState >= 2;
  return {
    isPlaying,
    isLoaded,
    surah: currentSurah,
    currentTime: audioEl?.currentTime ?? 0,
    duration: audioEl?.duration ?? 0,
    play: playQuranAudio,
    pause: pauseQuranAudio,
    resume: resumeQuranAudio,
    stop: stopQuranAudio,
  };
}
