// Lokal goals/niyats/stats'ni backendga davriy yuborish (sinxron).
// Auth token bo'lmasa (foydalanuvchi backend ulanmagan) — jim'cha o'tib ketadi.
// Debounce: ozgina o'zgarishlar bittaga yig'iladi (5 sekund).

import { useEffect, useRef, useCallback, useState } from "react";
import { useGoals } from "./use-goals";
import { useNiyats } from "./use-niyats";
import { useStats } from "./use-stats";
import { useUserProfile } from "./use-user-profile";
import { getAuthToken, setAuthToken } from "./use-auth-api";

const DEBOUNCE_MS = 5_000;
const MIN_INTERVAL_MS = 30_000; // server bombardimon qilmasligi uchun
const POLL_INTERVAL_MS = 60_000; // har minutda — ortiqcha resurs sarflamasin

// Token muddati o'tgan bo'lsa (401) — tokenni tozalaymiz va sahifani qayta
// yuklaymiz. Aks holda ilova "ishlamayotgan" his beradi: poll har minutda
// 401 oladi, hech narsa ko'rinmaydi, sync ishlamaydi.
// Throttle: bir sessiyada faqat bir marta reload qilamiz (cheksiz reload loop
// xavfini oldini olish uchun).
let authFailureHandled = false;
function handleAuthFailure(): void {
  if (authFailureHandled) return;
  authFailureHandled = true;
  console.warn("[profile-sync] token muddati o'tgan — tozalash va reload");
  setAuthToken(null);
  try {
    const raw = window.localStorage.getItem("niyat:profile");
    if (raw) {
      const profile = JSON.parse(raw);
      profile.loggedIn = false;
      window.localStorage.setItem("niyat:profile", JSON.stringify(profile));
    }
  } catch {
    /* ignore */
  }
  // Toza holatga qaytish — NiyatApp LoginScreen'ni ko'rsatadi
  if (typeof window !== "undefined") {
    window.setTimeout(() => window.location.reload(), 100);
  }
}

export function useProfileSync() {
  const { goals } = useGoals();
  const { items: niyats } = useNiyats();
  const stats = useStats();
  const { profile, setProfile } = useUserProfile();
  const [audioRequestPending, setAudioRequestPending] = useState(false);

  const lastSyncRef = useRef(0);
  const debounceRef = useRef<number | null>(null);

  // Server tomondan boshqariladigan flaglarni lokal profile'ga ozlashtiradi.
  // Faqat haqiqatan ham ozgargan bolsa setProfile chaqiriladi.
  const applyServerFlags = useCallback(
    (
      server:
        | { locationLocked?: boolean; audioRequestPending?: boolean }
        | undefined,
    ) => {
      if (!server) return;
      if (
        typeof server.locationLocked === "boolean" &&
        profile.locationLocked !== server.locationLocked
      ) {
        setProfile({ ...profile, locationLocked: server.locationLocked });
      }
      if (typeof server.audioRequestPending === "boolean") {
        setAudioRequestPending(server.audioRequestPending);
      }
    },
    [profile, setProfile],
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return; // Backend ulanmagan
    if (typeof window === "undefined") return;

    // Debounce
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const now = Date.now();
      if (now - lastSyncRef.current < MIN_INTERVAL_MS) return;
      lastSyncRef.current = now;

      try {
        const apiBase =
          (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
        const res = await fetch(`${apiBase}/api/profile/sync`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: [
              { key: "goals", value: goals },
              { key: "niyats", value: niyats },
              {
                key: "stats",
                value: {
                  totalTasksCompleted: stats.totalTasksCompleted,
                  currentStreak: stats.currentStreak,
                  longestStreak: stats.longestStreak,
                  level: stats.level,
                },
              },
              {
                key: "profile",
                value: {
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  photoDataUrl: profile.photoDataUrl ?? null,
                  isPremium: profile.isPremium,
                  premiumExpiresAt: profile.premiumExpiresAt ?? null,
                  claimedLevelRewards: profile.claimedLevelRewards ?? [],
                },
              },
            ],
          }),
        });
        if (res.status === 401) {
          handleAuthFailure();
          return;
        }
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as
            | {
                server?: {
                  locationLocked?: boolean;
                  audioRequestPending?: boolean;
                };
              }
            | null;
          applyServerFlags(data?.server);
        }
      } catch (err) {
        // Sync xato bo'lsa — keyingi safar urinib ko'ramiz, jim'cha o'tamiz
        console.warn("[profile-sync] failed", err);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [
    goals,
    niyats,
    stats.totalTasksCompleted,
    stats.currentStreak,
    stats.longestStreak,
    stats.level,
    profile.firstName,
    profile.lastName,
    profile.photoDataUrl,
    profile.isPremium,
    profile.premiumExpiresAt,
    applyServerFlags,
  ]);

  // Davriy polling — user idle turganda ham (POST sync state ozgarmagunca
  // ishlamaydi). Faqat GET so'rovi — server flaglarini olib turish uchun.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getAuthToken();
    console.log("[profile-sync] poll boshlandi, token bormi?", !!token);
    if (!token) {
      console.warn("[profile-sync] TOKEN YO'Q — polling ishlamaydi (login qiling)");
      return;
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const apiBase =
          (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
        const res = await fetch(`${apiBase}/api/profile/sync`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          handleAuthFailure();
          cancelled = true;
          return;
        }
        if (!res.ok) {
          console.warn("[profile-sync] poll HTTP", res.status);
          return;
        }
        const data = (await res.json().catch(() => null)) as
          | {
              server?: {
                locationLocked?: boolean;
                audioRequestPending?: boolean;
              };
            }
          | null;
        console.log("[profile-sync] poll javob:", data?.server);
        if (!cancelled) applyServerFlags(data?.server);
      } catch (err) {
        console.warn("[profile-sync] poll xato:", err);
      }
    };

    // Darhol birinchi marta
    void poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // applyServerFlags ataylab dep emas — har render'da yangidan ref bo'lib
    // pollni qayta yoqib yubormasligi uchun
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { audioRequestPending };
}
