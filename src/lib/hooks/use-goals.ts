import { useCallback, useMemo } from "react";
import { useLocalState } from "@/lib/use-local-state";
import {
  goals as initialGoals,
  type Goal,
  type GoalCadence,
} from "@/lib/niyat-data";

// Sananing ISO YYYY-MM-DD ko'rinishi
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Joriy hafta — Dushanbadan boshlanadi (O'zbekistonda Du-Yak hafta tartibi)
// Returns: { start: Date (Dushanba 00:00), end: Date (Yakshanba 23:59) }
function getCurrentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const day = now.getDay(); // 0=Yak, 1=Du, ..., 6=Sh
  // Dushanba'gacha qancha kun orqaga
  const daysFromMonday = (day + 6) % 7; // Yak=6, Du=0, Se=1, ..., Sh=5
  const start = new Date(now);
  start.setDate(now.getDate() - daysFromMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Joriy haftada qaysi ISO sanalar borligini qaytaradi (7 ta sana)
function currentWeekDates(now: Date = new Date()): string[] {
  const { start } = getCurrentWeekRange(now);
  const arr: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(toISODate(d));
  }
  return arr;
}

// Bugun shu maqsadning rejasiga to'g'ri keladimi?
// - daily:             ha (har kuni)
// - count:             ha (istalgan kunda)
// - specific:          faqat tanlangan hafta kunlari
// - monthly_count:     ha (oyning istalgan kunida bajarish mumkin)
// - monthly_specific:  faqat oyning tanlangan sanalarida
export function isToday(cadence: GoalCadence | undefined, now: Date = new Date()): boolean {
  if (!cadence) return true;
  if (cadence.kind === "daily") return true;
  if (cadence.kind === "count") return true;
  if (cadence.kind === "specific") return cadence.days.includes(now.getDay());
  if (cadence.kind === "monthly_count") return true;
  if (cadence.kind === "monthly_specific") return cadence.daysOfMonth.includes(now.getDate());
  return true;
}

// Maqsad joriy haftaga to'g'ri keladimi (haftalik tab'ga qo'shish uchun)?
export function isThisWeek(cadence: GoalCadence | undefined, now: Date = new Date()): boolean {
  if (!cadence) return false;
  if (cadence.kind === "daily") return true;
  if (cadence.kind === "count") return true;
  if (cadence.kind === "specific") return true;
  // monthly_count: oy davomida ko'rinadi
  if (cadence.kind === "monthly_count") return true;
  // monthly_specific: tanlangan sanalardan birortasi shu hafta bo'lsa
  if (cadence.kind === "monthly_specific") {
    const weekDates = currentWeekDates(now);
    return weekDates.some((iso) => {
      const dom = parseInt(iso.slice(-2), 10);
      return cadence.daysOfMonth.includes(dom);
    });
  }
  return false;
}

// Cadence uchun haftalik maqsad (target) — necha marta bajarish kerak
export function weeklyTarget(cadence: GoalCadence | undefined): number {
  if (!cadence) return 1;
  if (cadence.kind === "daily") return 7;
  if (cadence.kind === "count") return Math.max(1, cadence.targetPerWeek);
  if (cadence.kind === "specific") return Math.max(1, cadence.days.length);
  // Monthly cadence'lar haftalik nuqtai nazaridan: oddiygina haftalik hisob
  if (cadence.kind === "monthly_count") {
    return Math.max(1, Math.round(cadence.targetPerMonth / 4));
  }
  if (cadence.kind === "monthly_specific") {
    // Bu hafta tanlangan sanalardan qanchasi bor
    const weekDates = currentWeekDates();
    return Math.max(
      1,
      weekDates.filter((iso) => cadence.daysOfMonth.includes(parseInt(iso.slice(-2), 10))).length,
    );
  }
  return 1;
}

// Joriy haftada qancha marta bajarilgan
export function completedThisWeek(goal: Goal, now: Date = new Date()): number {
  const weekISO = new Set(currentWeekDates(now));
  return goal.completedDates.filter((d) => weekISO.has(d)).length;
}

// Joriy hafta uchun progress nisbati (0..1)
export function weeklyProgress(goal: Goal, now: Date = new Date()): number {
  const target = weeklyTarget(goal.cadence);
  const done = completedThisWeek(goal, now);
  return Math.min(1, done / target);
}

// ========== Oylik helper'lar ==========
function daysInMonth(d: Date = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function isInCurrentMonth(iso: string, now: Date = new Date()): boolean {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return iso.startsWith(monthKey);
}

// Cadence uchun oylik maqsad — necha marta bajarish kerak
export function monthlyTarget(cadence: GoalCadence | undefined, now: Date = new Date()): number {
  if (!cadence) return 1;
  if (cadence.kind === "daily") return daysInMonth(now);
  if (cadence.kind === "count") {
    // Haftada N marta × oydagi haftalar soni (4 yoki 5)
    const totalDays = daysInMonth(now);
    return Math.max(1, Math.round((cadence.targetPerWeek * totalDays) / 7));
  }
  if (cadence.kind === "specific") {
    // Hafta kunlari oyda necha marta uchraydi (taxminan)
    const totalDays = daysInMonth(now);
    return Math.max(1, Math.round((cadence.days.length * totalDays) / 7));
  }
  if (cadence.kind === "monthly_count") return Math.max(1, cadence.targetPerMonth);
  if (cadence.kind === "monthly_specific") return Math.max(1, cadence.daysOfMonth.length);
  return 1;
}

export function completedThisMonth(goal: Goal, now: Date = new Date()): number {
  return goal.completedDates.filter((iso) => isInCurrentMonth(iso, now)).length;
}

export function monthlyProgress(goal: Goal, now: Date = new Date()): number {
  const target = monthlyTarget(goal.cadence, now);
  const done = completedThisMonth(goal, now);
  return Math.min(1, done / target);
}

// Davriy (period-aware) helper — goal.scope'ga qarab haftalik/oylik
export function periodProgress(goal: Goal, now: Date = new Date()): number {
  if (goal.scope === "monthly") return monthlyProgress(goal, now);
  return weeklyProgress(goal, now);
}

export function periodTarget(goal: Goal, now: Date = new Date()): number {
  if (goal.scope === "monthly") return monthlyTarget(goal.cadence, now);
  return weeklyTarget(goal.cadence);
}

export function periodCompleted(goal: Goal, now: Date = new Date()): number {
  if (goal.scope === "monthly") return completedThisMonth(goal, now);
  return completedThisWeek(goal, now);
}

export function periodLabel(scope: Goal["scope"]): string {
  if (scope === "monthly") return "Bu oy";
  if (scope === "daily") return "Bugun";
  return "Bu hafta";
}

// Bugun bajarilganmi?
export function isCompletedToday(goal: Goal, now: Date = new Date()): boolean {
  return goal.completedDates.includes(toISODate(now));
}

// Maqsadni bugungi kun ko'rinishida ko'rsatish kerakmi?
// - scope="daily":   doim ha
// - scope="weekly":  cadence bor va bugunga to'g'ri kelsa
// - scope="monthly": cadence bor va bugunga to'g'ri kelsa
// - scope="yearly":  yo'q
// Cadence yo'q bo'lsa — faqat o'z scope tab'ida ko'rinadi.
export function shouldShowToday(goal: Goal, now: Date = new Date()): boolean {
  if (goal.scope === "daily") return true;
  if (!goal.cadence) return false;
  if (goal.scope === "weekly") return isToday(goal.cadence, now);
  if (goal.scope === "monthly") return isToday(goal.cadence, now);
  return false;
}

// Maqsadni bu hafta ko'rinishida ko'rsatish kerakmi (haftalik tab uchun)?
// - scope="weekly":  doim
// - scope="monthly": cadence bor va shu hafta to'g'ri kelsa
// - scope="daily":   yo'q (har kuni tab'i o'zida ko'rinadi)
// - scope="yearly":  yo'q
export function shouldShowThisWeek(goal: Goal, now: Date = new Date()): boolean {
  if (goal.scope === "weekly") return true;
  if (goal.scope === "monthly") {
    if (!goal.cadence) return false;
    return isThisWeek(goal.cadence, now);
  }
  return false;
}

// Vaqti bo'yicha sort qilish — vaqti bor maqsadlar oldida, vaqtisizlar oxirida.
// HH:MM oddiy string solishtirilsa to'g'ri tartiblanadi.
export function sortByTimeOfDay(a: Goal, b: Goal): number {
  if (a.timeOfDay && b.timeOfDay) return a.timeOfDay.localeCompare(b.timeOfDay);
  if (a.timeOfDay) return -1;
  if (b.timeOfDay) return 1;
  return 0;
}

// Cadence'ni inson tilida tasvirlash (kartochkada ko'rsatish uchun)
const WEEKDAY_LABELS_SHORT = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];

export function describeCadence(cadence: GoalCadence | undefined): string {
  if (!cadence) return "";
  if (cadence.kind === "daily") return "Har kuni";
  if (cadence.kind === "count") return `Haftada ${cadence.targetPerWeek} marta`;
  if (cadence.kind === "specific") {
    const labels = cadence.days
      .slice()
      .sort()
      .map((d) => WEEKDAY_LABELS_SHORT[d]);
    return labels.join(" · ");
  }
  if (cadence.kind === "monthly_count") return `Oyda ${cadence.targetPerMonth} marta`;
  if (cadence.kind === "monthly_specific") {
    const days = [...cadence.daysOfMonth].sort((a, b) => a - b);
    if (days.length === 1) return `Oyning ${days[0]}-kuni`;
    return `${days.join(", ")}-kunlari`;
  }
  return "";
}

// Eski (cadence'siz) maqsadlarni xavfsiz qilish
function normalizeGoal(g: Goal): Goal {
  return {
    ...g,
    completedDates: Array.isArray(g.completedDates) ? g.completedDates : [],
  };
}

// Scope iyerarxiyasi — qaysi scope qaysi parent bo'la oladi.
// yearly > monthly > weekly > daily
const SCOPE_RANK: Record<Goal["scope"], number> = {
  yearly: 4,
  monthly: 3,
  weekly: 2,
  daily: 1,
};

// Berilgan scope uchun mumkin bo'lgan parent scope'lar (kattaroqlari).
export function eligibleParentScopes(scope: Goal["scope"]): Goal["scope"][] {
  const rank = SCOPE_RANK[scope];
  return (Object.keys(SCOPE_RANK) as Goal["scope"][]).filter(
    (s) => SCOPE_RANK[s] > rank,
  );
}

// Iyerarxik label — eng kichik birlik uchun chiroyli ko'rinish
export const SCOPE_LABEL: Record<Goal["scope"], string> = {
  yearly: "Yillik",
  monthly: "Oylik",
  weekly: "Haftalik",
  daily: "Kunlik",
};

export function useGoals() {
  const [stored, setStored] = useLocalState<Goal[]>("niyat:goals:list", initialGoals);
  // Backwards-compat: eski localStorage'da completedDates yo'q
  const goals = useMemo(() => stored.map(normalizeGoal), [stored]);

  const add = useCallback(
    (goal: Omit<Goal, "id" | "completedDates" | "createdAt">) => {
      const newGoal: Goal = {
        ...goal,
        id: `g-${Date.now()}`,
        completedDates: [],
        createdAt: Date.now(),
      };
      setStored((prev) => [newGoal, ...prev]);
      return newGoal;
    },
    [setStored],
  );

  const update = useCallback(
    (id: string, patch: Partial<Goal>) => {
      setStored((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    },
    [setStored],
  );

  const remove = useCallback(
    (id: string) => {
      setStored((prev) => prev.filter((g) => g.id !== id));
    },
    [setStored],
  );

  // Bugun bajarganlikni belgilash/yechish — toggle
  const toggleToday = useCallback(
    (id: string) => {
      const todayIso = toISODate(new Date());
      setStored((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          const isDone = g.completedDates.includes(todayIso);
          return {
            ...g,
            completedDates: isDone
              ? g.completedDates.filter((d) => d !== todayIso)
              : [...g.completedDates, todayIso],
          };
        }),
      );
    },
    [setStored],
  );

  // Aniq sana uchun belgilash (haftalik tarmoq UI uchun kerak bo'lishi mumkin)
  const toggleDate = useCallback(
    (id: string, isoDate: string) => {
      setStored((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          const isDone = g.completedDates.includes(isoDate);
          return {
            ...g,
            completedDates: isDone
              ? g.completedDates.filter((d) => d !== isoDate)
              : [...g.completedDates, isoDate],
          };
        }),
      );
    },
    [setStored],
  );

  // Iyerarxiya helper'lari — parent va children topish
  const getChildrenOf = useCallback(
    (parentId: string): Goal[] => goals.filter((g) => g.parentId === parentId),
    [goals],
  );

  const getParentOf = useCallback(
    (goal: Goal): Goal | null => {
      if (!goal.parentId) return null;
      return goals.find((g) => g.id === goal.parentId) ?? null;
    },
    [goals],
  );

  // O'chirishda nima qilish kerak — barcha children'larning parent'ini
  // ham nollab qo'yamiz (yetim qoldirmaymiz).
  const removeWithChildren = useCallback(
    (id: string) => {
      setStored((prev) =>
        prev
          .filter((g) => g.id !== id)
          .map((g) => (g.parentId === id ? { ...g, parentId: undefined } : g)),
      );
    },
    [setStored],
  );

  return {
    goals,
    add,
    update,
    remove: removeWithChildren,
    toggleToday,
    toggleDate,
    setGoals: setStored,
    getChildrenOf,
    getParentOf,
  };
}
