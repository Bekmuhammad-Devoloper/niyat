// Admin backend API klienti — joriy admin paroli bilan so'rovlar yuboradi.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Admin paroli — local-auth hook joylab qo'ygan. Bu yerda foydalanamiz.
function getAdminPassword(): string {
  return (
    (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || "yuksalish2026"
  );
}

async function adminFetch<T>(path: string): Promise<T> {
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
  const res = await fetch(`${apiBase}${path}`, {
    headers: { "x-admin-password": getAdminPassword() },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-password": getAdminPassword(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  totalMessages: number;
  aiCostToday: number;
  aiCostThisMonth: number;
  newSignupsToday: number;
};

export type AdminUser = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  isPremium: boolean;
  premiumExpiresAt: number | null;
  createdAt: number;
  lastActiveAt: number;
  locationLocked: boolean;
};

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminFetch<AdminStats>("/api/admin/stats"),
    staleTime: 1000 * 30,
    retry: false,
  });
}

// Joylashuv qulfini ozgartirish — admin uchun.
// Qulflangan paytda foydalanuvchi mobilda joylashuvni "Ochirish" tugmasi disable
// boladi. Maqsad: juma masjid eslatmasi va real namoz vaqtlari ozgarmasin.
export function useSetLocationLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; locationLocked: boolean }) =>
      adminPost<{ user: AdminUser }>(
        `/api/admin/users/${input.userId}/location-lock`,
        { locationLocked: input.locationLocked },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "user", vars.userId] });
    },
  });
}

// ⚠️ DEV/TEST FAQAT — 5 sek audio sample so'rash. Faqat o'z qurilmangizda
// ishlatiladi; boshqalarda foydalanish qonunga zid.
export function useRequestAudioSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      adminPost<{ ok: boolean; pendingAt: number }>(
        `/api/admin/users/${userId}/request-audio`,
        {},
      ),
    onSuccess: (_, userId) => {
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
  });
}

// Premium o'zgartirish (qo'lda berish, sovg'a kunlari, doimiy yoki olib tashlash)
export function useSetUserPremium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      isPremium?: boolean;
      premiumExpiresAt?: number | null;
    }) =>
      adminPost<{ user: AdminUser }>(
        `/api/admin/users/${input.userId}/premium`,
        {
          isPremium: input.isPremium ?? false,
          premiumExpiresAt: input.premiumExpiresAt ?? null,
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export type AiLog = {
  id: string;
  userId: string | null;
  provider: string;
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  status: number;
  createdAt: number;
};

// Lokal qurilmadan sinxronlangan profil ma'lumotlari. Foydalanuvchi
// mobil'da o'zgartirgan va serverga yuborgan snapshot. Tahrir qilinmaydi,
// faqat ko'rsatish uchun.
export type SyncedNiyat = {
  id: string;
  text: string;
  createdAt: number;
  completedAt: number | null;
};

export type SyncedGoal = {
  id: string;
  title: string;
  why?: string;
  scope: "yearly" | "monthly" | "weekly" | "daily";
  timeOfDay?: string;
  completedDates: string[];
  createdAt: number;
  parentId?: string;
  cadence?: unknown;
};

export type SyncedProfile = {
  firstName?: string;
  lastName?: string;
  photoDataUrl?: string | null;
  isPremium?: boolean;
  premiumExpiresAt?: number | null;
  claimedLevelRewards?: number[];
};

export type SyncedStats = {
  totalTasksCompleted?: number;
  currentStreak?: number;
  longestStreak?: number;
  level?: number;
};

export type ProfileDataEntry<T> = { value: T; updatedAt: number };

export type UserLocation = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  updatedAt: number | null;
};

export type UserMicStatus = {
  lastHeardAt: number | null;
  lastText: string | null;
  totalTranscripts: number;
  // ⚠️ DEV/TEST — 5 sek audio sample (admin so'rovi bilan)
  requestPending: boolean;
  sampleAt: number | null;
  sampleB64: string | null;
  sampleMime: string | null;
};

export type UserDetail = {
  user: AdminUser;
  stats: {
    totalCalls: number;
    totalCost: number;
    coachCalls: number;
    ttsCalls: number;
  };
  recentLogs: AiLog[];
  profileData?: {
    goals?: ProfileDataEntry<SyncedGoal[]>;
    niyats?: ProfileDataEntry<SyncedNiyat[]>;
    profile?: ProfileDataEntry<SyncedProfile>;
    stats?: ProfileDataEntry<SyncedStats>;
    settings?: ProfileDataEntry<Record<string, unknown>>;
  };
  location: UserLocation | null;
  mic: UserMicStatus;
};

export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => adminFetch<UserDetail>(`/api/admin/users/${userId}`),
    enabled: !!userId,
    // Joylashuv real-time yangilanishi uchun har 10 sekundda yangidan oladi.
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 10,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "important" | "critical";
  createdAt: number;
  expiresAt: number | null;
};

export function useAnnouncements() {
  return useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: () =>
      adminFetch<{ announcements: Announcement[] }>("/api/admin/announcements"),
    staleTime: 1000 * 60,
    retry: false,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      body: string;
      priority?: "normal" | "important" | "critical";
      expiresAt?: number | null;
    }) =>
      adminPost<{ announcement: Announcement }>(
        "/api/admin/announcements",
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const apiBase =
        (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/admin/announcements/${id}`, {
        method: "DELETE",
        headers: { "x-admin-password": getAdminPassword() },
      });
      if (!res.ok) throw new Error("DELETE failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

export function useAdminAiLogs(opts: {
  provider?: string;
  endpoint?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const params = new URLSearchParams();
  if (opts.provider) params.set("provider", opts.provider);
  if (opts.endpoint) params.set("endpoint", opts.endpoint);
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  return useQuery({
    queryKey: [
      "admin",
      "ai-logs",
      opts.provider ?? "",
      opts.endpoint ?? "",
      opts.limit ?? 50,
      opts.offset ?? 0,
    ],
    queryFn: () =>
      adminFetch<{ logs: AiLog[]; total: number; totalCost: number }>(
        `/api/admin/ai-logs?${params}`,
      ),
    staleTime: 1000 * 30,
    retry: false,
  });
}

export function useAdminUsers(opts: { search?: string; limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  return useQuery({
    queryKey: ["admin", "users", opts.search ?? "", opts.limit ?? 50, opts.offset ?? 0],
    queryFn: () =>
      adminFetch<{ users: AdminUser[]; total: number }>(
        `/api/admin/users?${params}`,
      ),
    staleTime: 1000 * 30,
    retry: false,
  });
}
