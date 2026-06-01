import { useCallback, useEffect, useState } from "react";
import { useLocalState } from "@/lib/use-local-state";

// Ekran vaqti — kunlik. Ikki manba:
// 1) Avtomatik: tab visible bo'lganda hisoblanadi (faqat shu web ilova)
// 2) Manual: foydalanuvchi telefon sozlamasidan haqiqiy ekran vaqtini kiritadi
//    Manual qiymat berilsa, u ustun (web auto - faqat shu ilova)

type AppTimeState = {
  date: string; // YYYY-MM-DD
  todayMin: number; // ilovaga sarflangan vaqt (avtomatik)
  yesterdayMin: number;
  manualMin: number | null; // foydalanuvchi kiritgan telefon ekran vaqti
  yesterdayManualMin: number | null;
};

function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT: AppTimeState = {
  date: todayKey(),
  todayMin: 0,
  yesterdayMin: 0,
  manualMin: null,
  yesterdayManualMin: null,
};

export function useAppTime() {
  const [state, setState] = useLocalState<AppTimeState>("niyat:appTime", DEFAULT);
  // Tick state — UI'ni har 30s da yangilash uchun (state'ga yozish kech bo'lishi mumkin)
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Yangi kun boshlanganmi?
    const today = todayKey();
    if (state.date !== today) {
      setState({
        date: today,
        todayMin: 0,
        yesterdayMin: state.todayMin,
        manualMin: null,
        yesterdayManualMin: state.manualMin,
      });
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
      // Anomal qiymatlarni filter (masalan kompyuter uxlab qolgan bo'lsa)
      if (deltaMin > 0 && deltaMin < 2) {
        setState((prev) => {
          const k = todayKey();
          if (prev.date !== k) {
            return {
              date: k,
              todayMin: deltaMin,
              yesterdayMin: prev.todayMin,
              manualMin: null,
              yesterdayManualMin: prev.manualMin,
            };
          }
          return { ...prev, todayMin: prev.todayMin + deltaMin };
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
    };
    // setState ataylab deps'ga qo'shilmaydi — infinite loop'ni oldini olish
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.date]);

  // Manual qiymat — ustun. Bo'lmasa auto qiymat.
  const isManual = state.manualMin !== null;
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

  // Qo'lda kiritish
  const setManual = useCallback(
    (minutes: number | null) => {
      setState((prev) => ({ ...prev, manualMin: minutes }));
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
    autoTrackedMin: Math.floor(state.todayMin), // ma'lumot uchun
    setManual,
  };
}
