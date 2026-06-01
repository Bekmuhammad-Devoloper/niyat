import { useMemo } from "react";
import { useLocalState } from "@/lib/use-local-state";
import { useGoals, isCompletedToday, shouldShowToday } from "@/lib/hooks/use-goals";

// Bajarilgan vazifa kunlarining ISO sanalari ro'yxati.
type StreakDay = string; // ISO date "YYYY-MM-DD"

export type AppStats = {
  totalTasksCompleted: number;
  todayCompleted: number;
  todayTotal: number;
  totalGoals: number;
  completedGoals: number;
  averageGoalProgress: number;
  currentStreak: number;
  longestStreak: number;
  totalCoachMessages: number;
  sadaqaDays: number;
  level: number;
  levelLabel: string;
  nextLevel: string;
  levelProgress: number; // 0..1
  pointsToNext: number;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(days: StreakDay[]): { current: number; longest: number } {
  if (days.length === 0) return { current: 0, longest: 0 };
  const sorted = [...new Set(days)].sort();
  let longest = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const next = new Date(sorted[i]);
    const diff = (next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      cur++;
      longest = Math.max(longest, cur);
    } else {
      cur = 1;
    }
  }
  const last = sorted[sorted.length - 1];
  const today = todayISO();
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (last !== today && last !== yest) {
    return { current: 0, longest };
  }
  return { current: cur, longest };
}

function levelFor(
  tasksDone: number,
  streak: number,
): {
  level: number;
  label: string;
  next: string;
  progress: number;
  pointsToNext: number;
} {
  const points = tasksDone + streak * 2;
  const level = 1 + points / 30;
  const wholeLevel = Math.floor(level * 10) / 10;
  const next = Math.round((wholeLevel + 0.1) * 10) / 10;
  const progress = (level - Math.floor(level)) % 1;
  const pointsToNext = Math.max(1, Math.round((next - 1) * 30) - points);
  return {
    level: wholeLevel,
    label: `Inson ${wholeLevel.toFixed(1)} darajasi`,
    next: `v${next.toFixed(1)}`,
    progress,
    pointsToNext,
  };
}

export function useStats(): AppStats & { markTaskDone: () => void } {
  // Endi vazifalar Maqsadlar (useGoals) bilan bir xil — alohida task ro'yxati yo'q
  const { goals } = useGoals();
  const [completedDays, setCompletedDays] = useLocalState<StreakDay[]>(
    "niyat:stats:completedDays",
    [],
  );
  const [messageCount] = useLocalState<number>("niyat:stats:messageCount", 0);
  const [sadaqaCount] = useLocalState<number>("niyat:stats:sadaqaCount", 0);

  const stats = useMemo<AppStats>(() => {
    // Bugungi rejada bo'lgan maqsadlar
    const todayGoals = goals.filter((g) => shouldShowToday(g));
    const todayCompleted = todayGoals.filter((g) => isCompletedToday(g)).length;
    const todayTotal = todayGoals.length;

    // Barcha vaqtdagi bajarilganlar — completedDates'larning yig'indisi
    const totalTasksCompleted = goals.reduce(
      (sum, g) => sum + g.completedDates.length,
      0,
    );

    const completedGoals = goals.filter((g) => (g.progress ?? 0) >= 1).length;
    const averageGoalProgress =
      goals.length > 0
        ? goals.reduce(
            (sum, g) => sum + Math.min(1, Math.max(0, g.progress ?? 0)),
            0,
          ) / goals.length
        : 0;

    // Streak — har kuni hech bo'lmaganda bitta maqsad bajarilgan kunlar
    const allDates = new Set<string>(completedDays);
    for (const g of goals) {
      for (const d of g.completedDates) allDates.add(d);
    }
    const { current, longest } = computeStreak([...allDates]);

    const lvl = levelFor(totalTasksCompleted, current);

    return {
      totalTasksCompleted,
      todayCompleted,
      todayTotal,
      totalGoals: goals.length,
      completedGoals,
      averageGoalProgress,
      currentStreak: current,
      longestStreak: longest,
      totalCoachMessages: messageCount,
      sadaqaDays: sadaqaCount,
      level: lvl.level,
      levelLabel: lvl.label,
      nextLevel: lvl.next,
      levelProgress: lvl.progress,
      pointsToNext: lvl.pointsToNext,
    };
  }, [goals, completedDays, messageCount, sadaqaCount]);

  // Maqsad bajarilganda chaqiriladi — bugungi sanani streak'ga qo'shadi
  const markTaskDone = () => {
    const today = todayISO();
    setCompletedDays((prev) => (prev.includes(today) ? prev : [...prev, today]));
  };

  return { ...stats, markTaskDone };
}
