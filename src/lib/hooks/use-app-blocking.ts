import { useCallback, useMemo } from "react";
import { useLocalState } from "@/lib/use-local-state";

export type BlockedApp = {
  packageName: string; // Android paket nomi (com.instagram.android)
  name: string; // "Instagram"
  emoji: string; // "📷"
  category: "social" | "video" | "messaging" | "game" | "other";
  enabled: boolean;
  dailyLimitMinutes: number; // 0 = limit yo'q
  usedTodayMinutes: number; // bugun shu ilova qancha ishlatilgan
};

export type Schedule = {
  enabled: boolean;
  from: string; // "22:00"
  to: string; // "07:00"
  appliedDays: number[]; // 0-6 (yakshanba-shanba)
};

export type AppBlockingSettings = {
  enabled: boolean; // umumiy yoqilgan/o'chirilgan
  blockedApps: BlockedApp[];
  nightMode: Schedule; // tunda barcha bloklangan ilovalar yopiq
  antiScroll: {
    enabled: boolean;
    warnAfterMinutes: number; // X daqiqadan keyin ogohlantirish
    breakReminderMinutes: number; // tanaffus eslatmasi
  };
  delayBeforeOpen: number; // ilova ochishdan oldin necha soniya kutish (15s default)
  showOverlay: boolean; // bizning overlay chiqsinmi?
  motivationalMessages: boolean; // overlay'da niyat eslatmasi
};

// Default ro'yxat — eng ko'p ishlatiladigan "vaqt o'g'rilari"
const DEFAULT_APPS: BlockedApp[] = [
  {
    packageName: "com.instagram.android",
    name: "Instagram",
    emoji: "📷",
    category: "social",
    enabled: true,
    dailyLimitMinutes: 30,
    usedTodayMinutes: 0,
  },
  {
    packageName: "com.zhiliaoapp.musically",
    name: "TikTok",
    emoji: "🎵",
    category: "video",
    enabled: true,
    dailyLimitMinutes: 20,
    usedTodayMinutes: 0,
  },
  {
    packageName: "com.google.android.youtube",
    name: "YouTube",
    emoji: "▶️",
    category: "video",
    enabled: false,
    dailyLimitMinutes: 60,
    usedTodayMinutes: 0,
  },
  {
    packageName: "com.twitter.android",
    name: "X (Twitter)",
    emoji: "✖️",
    category: "social",
    enabled: false,
    dailyLimitMinutes: 30,
    usedTodayMinutes: 0,
  },
  {
    packageName: "com.facebook.katana",
    name: "Facebook",
    emoji: "📘",
    category: "social",
    enabled: false,
    dailyLimitMinutes: 30,
    usedTodayMinutes: 0,
  },
  {
    packageName: "com.snapchat.android",
    name: "Snapchat",
    emoji: "👻",
    category: "social",
    enabled: false,
    dailyLimitMinutes: 20,
    usedTodayMinutes: 0,
  },
  {
    packageName: "com.reddit.frontpage",
    name: "Reddit",
    emoji: "🤖",
    category: "social",
    enabled: false,
    dailyLimitMinutes: 30,
    usedTodayMinutes: 0,
  },
];

const DEFAULT_SETTINGS: AppBlockingSettings = {
  enabled: false,
  blockedApps: DEFAULT_APPS,
  nightMode: {
    enabled: true,
    from: "22:00",
    to: "07:00",
    appliedDays: [0, 1, 2, 3, 4, 5, 6],
  },
  antiScroll: {
    enabled: true,
    warnAfterMinutes: 15,
    breakReminderMinutes: 30,
  },
  delayBeforeOpen: 15,
  showOverlay: true,
  motivationalMessages: true,
};

export function useAppBlocking() {
  const [settings, setSettings] = useLocalState<AppBlockingSettings>(
    "niyat:appBlocking",
    DEFAULT_SETTINGS,
  );

  const toggleEnabled = useCallback(() => {
    setSettings((s) => ({ ...s, enabled: !s.enabled }));
  }, [setSettings]);

  const toggleApp = useCallback(
    (packageName: string) => {
      setSettings((s) => ({
        ...s,
        blockedApps: s.blockedApps.map((a) =>
          a.packageName === packageName ? { ...a, enabled: !a.enabled } : a,
        ),
      }));
    },
    [setSettings],
  );

  const setAppLimit = useCallback(
    (packageName: string, minutes: number) => {
      setSettings((s) => ({
        ...s,
        blockedApps: s.blockedApps.map((a) =>
          a.packageName === packageName ? { ...a, dailyLimitMinutes: minutes } : a,
        ),
      }));
    },
    [setSettings],
  );

  const updateNightMode = useCallback(
    (patch: Partial<Schedule>) => {
      setSettings((s) => ({ ...s, nightMode: { ...s.nightMode, ...patch } }));
    },
    [setSettings],
  );

  const updateAntiScroll = useCallback(
    (patch: Partial<AppBlockingSettings["antiScroll"]>) => {
      setSettings((s) => ({ ...s, antiScroll: { ...s.antiScroll, ...patch } }));
    },
    [setSettings],
  );

  const stats = useMemo(() => {
    const active = settings.blockedApps.filter((a) => a.enabled);
    const totalLimitMin = active.reduce((sum, a) => sum + a.dailyLimitMinutes, 0);
    const totalUsedMin = active.reduce((sum, a) => sum + a.usedTodayMinutes, 0);
    return {
      activeCount: active.length,
      totalLimitMin,
      totalUsedMin,
      remainingMin: Math.max(0, totalLimitMin - totalUsedMin),
    };
  }, [settings.blockedApps]);

  return {
    settings,
    setSettings,
    stats,
    toggleEnabled,
    toggleApp,
    setAppLimit,
    updateNightMode,
    updateAntiScroll,
  };
}
