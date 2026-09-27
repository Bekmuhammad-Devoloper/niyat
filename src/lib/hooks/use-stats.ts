import { useMemo } from "react";
import { useLocalState } from "@/lib/use-local-state";
import {
  useGoals,
  isCompletedToday,
  shouldShowToday,
  periodProgress,
} from "@/lib/hooks/use-goals";

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

function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO(): string {
  return toLocalISO(new Date());
}

// Kecha — mahalliy sana bo'yicha (toISOString UTC'da — 00:00-05:00 orasida
// noto'g'ri kun chiqib, streak 0 bo'lib qolar edi)
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalISO(d);
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
  const yest = yesterdayISO();
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
  // 30 ball = 1 daraja → har 0.1 daraja = 3 ball
  const POINTS_PER_STEP = 3;
  const level = 1 + points / 30;
  const wholeLevel = Math.floor(level * 10) / 10;
  const next = Math.round((wholeLevel + 0.1) * 10) / 10;
  // Progress — keyingi 0.1 qadamgacha (nextLevel/pointsToNext bilan bir xil o'lchov)
  const progress = (points % POINTS_PER_STEP) / POINTS_PER_STEP;
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

    // Cadence'li maqsadlar — davriy (hafta/oy) progress; eski yillik
    // maqsadlar — qo'lda kiritilgan g.progress (0..1)
    const goalProgress = (g: (typeof goals)[number]): number =>
      g.cadence ? periodProgress(g) : (g.progress ?? 0);
    const completedGoals = goals.filter((g) => goalProgress(g) >= 1).length;
    const averageGoalProgress =
      goals.length > 0
        ? goals.reduce(
            (sum, g) => sum + Math.min(1, Math.max(0, goalProgress(g))),
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
