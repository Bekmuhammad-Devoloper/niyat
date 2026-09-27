import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalState } from "@/lib/use-local-state";

// Ekran vaqti — kunlik. Manbalar:
// 1) Avtomatik: tab visible bo'lganda hisoblanadi (faqat shu web ilova)
//    + ekran/tabga ko'ra ajratiladi (Coach, Goals, Worship, Home, Me)
// 2) Manual: foydalanuvchi telefon sozlamasidan haqiqiy ekran vaqtini kiritadi.
//    Bir marta kiritilgach — shu kun davomida QULFLANADI (o'zgartirib bo'lmaydi).
//    Ertasiga avtomatik yangi kun boshlanadi.

export type ScreenKey = "home" | "goals" | "coach" | "worship" | "me";

type AppTimeState = {
  date: string; // YYYY-MM-DD
  todayMin: number; // ilovaga sarflangan jami vaqt (avtomatik)
  yesterdayMin: number;
  manualMin: number | null; // foydalanuvchi kiritgan telefon ekran vaqti
  manualLockedAt: number | null; // unix ms — qulflangan vaqt (kun davomida o'zgarmaydi)
  yesterdayManualMin: number | null;
  // Ekran bo'yicha ajratilgan vaqt (daqiqalarda)
  perScreen: Record<ScreenKey, number>;
  yesterdayPerScreen: Record<ScreenKey, number>;
  // Foydalanuvchi joriy paytda qaysi ekranda — visibility/interval shuni hisoblaydi
  activeScreen: ScreenKey | null;
};

function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_PER_SCREEN: Record<ScreenKey, number> = {
  home: 0,
  goals: 0,
  coach: 0,
  worship: 0,
  me: 0,
};

// date: bo'sh — haqiqiy kun kaliti effect ichida hisoblanadi (modul yuklanish
// vaqtidagi sana yarim tunda eskirib qoladi).
const DEFAULT: AppTimeState = {
  date: "",
  todayMin: 0,
  yesterdayMin: 0,
  manualMin: null,
  manualLockedAt: null,
  yesterdayManualMin: null,
  perScreen: { ...EMPTY_PER_SCREEN },
  yesterdayPerScreen: { ...EMPTY_PER_SCREEN },
  activeScreen: null,
};

// Vaqt hisoblash — SINGLETON. useAppTime() bir nechta joyda (NiyatApp,
// HomeScreen, ScreenTimeSheet) chaqiriladi; har biri o'z intervalini yursa,
// delta N marta qo'shilib ketadi. Faqat bitta "egasi" bo'lgan instansiya
// interval/visibility hisobini yuritadi, qolganlari faqat state'ni o'qiydi.
let trackerOwner: symbol | null = null;
// Egasi unmount bo'lganda (masalan, child ekran yopilganda) qolgan mount
// bo'lgan instansiyalardan biri egalikni qayta olishi uchun — ularga signal.
const trackerWaiters = new Set<() => void>();
function releaseTracker(id: symbol): void {
  if (trackerOwner !== id) return;
  trackerOwner = null;
  trackerWaiters.forEach((fn) => fn());
}

export function useAppTime() {
  const [stored, setState, hydrated] = useLocalState<AppTimeState>(
    "niyat:appTime",
    DEFAULT,
  );
  // Eski install'larda perScreen/yesterdayPerScreen bo'lmasligi mumkin —
  // default bilan birlashtiramiz, crash bo'lmasin.
  const state = useMemo<AppTimeState>(
    () => ({
      ...DEFAULT,
      ...stored,
      perScreen: stored.perScreen ?? { ...EMPTY_PER_SCREEN },
      yesterdayPerScreen: stored.yesterdayPerScreen ?? { ...EMPTY_PER_SCREEN },
    }),
    [stored],
  );
  // Tick state — UI'ni har 30s da yangilash uchun
  const [, setTick] = useState(0);
  // Har bir instansiya uchun noyob identifikator — tracker egasini aniqlash uchun
  const idRef = useRef(Symbol("appTime"));
  // Egasi bo'shaganda qayta urinish uchun tick
  const [claimTick, setClaimTick] = useState(0);

  // Yangi kun boshlanganmi? — manual lock va per-screen ham yangilanadi.
  // Faqat localStorage o'qilgandan keyin (hydrated) — aks holda DEFAULT
  // asosida saqlangan ma'lumot ustiga yozib yuboramiz.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    const today = todayKey();
    if (state.date === today) return;
    setState((prev) => {
      if (prev.date === today) return prev;
      return {
        date: today,
        todayMin: 0,
        yesterdayMin: prev.todayMin,
        manualMin: null,
        manualLockedAt: null,
        yesterdayManualMin: prev.manualMin,
        perScreen: { ...EMPTY_PER_SCREEN },
        yesterdayPerScreen: prev.perScreen ?? { ...EMPTY_PER_SCREEN },
        activeScreen: prev.activeScreen ?? null,
      };
    });
    // setState ataylab deps'ga qo'shilmaydi — infinite loop'ni oldini olish
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.date, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    // Singleton: egasi bo'lmasa — shu instansiya egasi bo'ladi. Boshqa
    // instansiya egasi bo'lsa — kutamiz (faqat o'qiymiz); egasi bo'shasa
    // claimTick orqali qayta urinamiz.
    const myId = idRef.current;
    if (trackerOwner === null) trackerOwner = myId;
    if (trackerOwner !== myId) {
      const retry = () => setClaimTick((t) => t + 1);
      trackerWaiters.add(retry);
      return () => {
        trackerWaiters.delete(retry);
      };
    }

    let lastTick = Date.now();
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        lastTick = Date.now();
        return;
      }
      const now = Date.now();
      const deltaMin = (now - lastTick) / 60000;
      lastTick = now;
      // Anomal qiymatlarni filter (uxlab qolish va h.k.)
      if (deltaMin > 0 && deltaMin < 2) {
        setState((prev) => {
          const k = todayKey();
          if (prev.date !== k) {
            // Yangi kun
            return {
              date: k,
              todayMin: deltaMin,
              yesterdayMin: prev.todayMin,
              manualMin: null,
              manualLockedAt: null,
              yesterdayManualMin: prev.manualMin,
              perScreen: prev.activeScreen
                ? { ...EMPTY_PER_SCREEN, [prev.activeScreen]: deltaMin }
                : { ...EMPTY_PER_SCREEN },
              yesterdayPerScreen: prev.perScreen ?? { ...EMPTY_PER_SCREEN },
              activeScreen: prev.activeScreen ?? null,
            };
          }
          const nextPerScreen = { ...EMPTY_PER_SCREEN, ...(prev.perScreen ?? {}) };
          if (prev.activeScreen) {
            nextPerScreen[prev.activeScreen] =
              (nextPerScreen[prev.activeScreen] ?? 0) + deltaMin;
          }
          return {
            ...prev,
            todayMin: (prev.todayMin ?? 0) + deltaMin,
            perScreen: nextPerScreen,
          };
        });
      }
      setTick((t) => t + 1);
    }, 30000);

    const onVisibility = () => {
      lastTick = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      // Egalikni bo'shatamiz — kutayotgan instansiyalardan biri oladi
      releaseTracker(myId);
    };
    // setState ataylab deps'ga qo'shilmaydi — infinite loop'ni oldini olish
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, claimTick]);

  // Manual qiymat — ustun. Bo'lmasa auto qiymat.
  const isManual = state.manualMin !== null;
  const isLocked = state.manualLockedAt != null;
  const todayMin = Math.floor(state.manualMin ?? state.todayMin);
  const yesterdayMin = Math.floor(
    state.yesterdayManualMin ?? state.yesterdayMin,
  );

  // Format: "2s 14d" yoki "14d"
  const hours = Math.floor(todayMin / 60);
  const mins = todayMin % 60;
  const formatted = hours > 0 ? `${hours}s ${mins}d` : `${mins}d`;

  // Trend — kechagiga nisbatan
  let trendPct: number | null = null;
  let trendDir: "up" | "down" | "same" | null = null;
  if (yesterdayMin > 0) {
    const diff = todayMin - yesterdayMin;
    trendPct = Math.round((Math.abs(diff) / yesterdayMin) * 100);
    trendDir = diff > 0 ? "up" : diff < 0 ? "down" : "same";
  }

  // Qo'lda kiritish — bir marta. Saqlagandan keyin shu kun davomida qulflanadi.
  const setManual = useCallback(
    (minutes: number) => {
      setState((prev) => {
        // Allaqachon qulflangan bo'lsa — o'zgartirmaymiz
        if (prev.manualLockedAt != null) return prev;
        return {
          ...prev,
          manualMin: minutes,
          manualLockedAt: Date.now(),
        };
      });
    },
    [setState],
  );

  // Joriy ekranni belgilash — tab almashtirilganda chaqiriladi
  const setActiveScreen = useCallback(
    (screen: ScreenKey | null) => {
      setState((prev) => {
        if (prev.activeScreen === screen) return prev;
        return { ...prev, activeScreen: screen };
      });
    },
    [setState],
  );

  return {
    todayMin,
    yesterdayMin,
    formatted,
    trendPct,
    trendDir,
    isManual,
    isLocked,
    lockedAt: state.manualLockedAt,
    autoTrackedMin: Math.floor(state.todayMin), // ma'lumot uchun
    perScreen: state.perScreen,
    yesterdayPerScreen: state.yesterdayPerScreen,
    activeScreen: state.activeScreen,
    setManual,
    setActiveScreen,
  };
}
