// Backend auth client — register, login, me.
// Token localStorage'da saqlanadi (niyat:auth:token).
// Backend ulanmagan bo'lsa (503), graceful — faqat lokal profil saqlanadi.

import { useCallback } from "react";

const TOKEN_KEY = "niyat:auth:token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  // Orqa fonda ishlaydigan runner'ga ham yetkazamiz (ilova yopiq paytda
  // joylashuvni yuborish uchun token kerak).
  void syncTokenToBackgroundRunner(token);
}

// Background runner — alohida JS kontekstda. Token uni KV orqali topadi.
// Asosiy ilova localStorage'iga kira olmaydi, shuning uchun aniq jonatish kerak.
async function syncTokenToBackgroundRunner(token: string | null): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { BackgroundRunner } = await import("@capacitor/background-runner");
    const apiBase =
      (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    if (token) {
      await BackgroundRunner.dispatchEvent({
        label: "uz.yuksalish.niyat.location",
        event: "setup",
        details: { token, apiBase },
      });
    } else {
      await BackgroundRunner.dispatchEvent({
        label: "uz.yuksalish.niyat.location",
        event: "clear",
        details: {},
      });
    }
  } catch (err) {
    // Web'da yoki plugin yo'q bo'lsa — jim'cha o'tib ketamiz
    if (typeof console !== "undefined") {
      console.debug("[bg-runner] sync skipped", err);
    }
  }
}

type PublicUser = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  isPremium: boolean;
  premiumExpiresAt: number | null;
  createdAt: number;
  lastActiveAt: number;
};

type AuthResult = { token: string; user: PublicUser };

export type AuthError = {
  status: number;
  message: string;
  // True bo'lsa — backend hali sozlanmagan (503), graceful fallback
  backendDown: boolean;
};

function isAuthError(err: unknown): err is AuthError {
  return typeof err === "object" && err !== null && "status" in err;
}

async function postJson<T>(
  url: string,
  body: unknown,
): Promise<T> {
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
  const res = await fetch(`${apiBase}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const err: AuthError = {
      status: res.status,
      message: data.error ?? `HTTP ${res.status}`,
      backendDown: res.status === 503,
    };
    throw err;
  }
  return (await res.json()) as T;
}

// Server'dagi profile_data'ni olib, lokal localStorage'ga yuklash.
// Backend ulanmagan yoki ma'lumot yo'q bo'lsa — sukut.
async function restoreProfileFromServer(token: string): Promise<{ restored: number }> {
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
  try {
    const res = await fetch(`${apiBase}/api/profile/sync`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { restored: 0 };
    const data = (await res.json()) as {
      items: Record<string, { value: unknown; updatedAt: number }>;
    };
    let count = 0;
    // Har key uchun localStorage'ga yozish
    const keyMap: Record<string, string> = {
      goals: "niyat:goals:list",
      niyats: "niyat:home:items",
      // stats va settings hozircha skipped — local va server formatlari farq qiladi
    };
    for (const [key, entry] of Object.entries(data.items)) {
      const storageKey = keyMap[key];
      if (!storageKey) continue;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(entry.value));
        count++;
      } catch {
        /* quota / storage xato */
      }
    }
    return { restored: count };
  } catch {
    return { restored: 0 };
  }
}

export function useAuthApi() {
  const register = useCallback(
    async (input: {
      firstName: string;
      lastName: string;
      phone: string;
      password: string;
    }): Promise<AuthResult> => {
      const result = await postJson<AuthResult>("/api/auth/register", input);
      setAuthToken(result.token);
      return result;
    },
    [],
  );

  const login = useCallback(
    async (input: { phone: string; password: string }): Promise<AuthResult> => {
      const result = await postJson<AuthResult>("/api/auth/login", input);
      setAuthToken(result.token);
      // Login muvaffaqiyatli — server'dagi ma'lumotlarni olib kelamiz
      // (boshqa qurilmadan kirgan bo'lsa, hisobni tiklash uchun)
      await restoreProfileFromServer(result.token);
      return result;
    },
    [],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
  }, []);

  return { register, login, logout };
}

export { isAuthError };
