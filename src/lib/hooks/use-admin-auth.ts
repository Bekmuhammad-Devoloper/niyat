// Admin panel auth — parol SERVER'da tekshiriladi (GET /api/admin/stats
// x-admin-password header bilan; 401 = noto'g'ri). Ilgari parol
// VITE_ADMIN_PASSWORD orqali client bundle'ga kompilyatsiya qilinar edi — bu
// har kim view-source qilib ko'ra oladigan xavfsizlik teshigi edi.
// useSyncExternalStore bilan global localStorage'ni reaktiv kuzatadi.
// Bir komponentda login bo'lsa, boshqalari ham darhol bilishadi.

import { useCallback, useSyncExternalStore } from "react";

const ADMIN_SESSION_KEY = "niyat:admin:session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type AdminSession = {
  loginAt: number;
  expiresAt: number;
  // Foydalanuvchi kiritgan parol — har admin so'roviga header sifatida ketadi.
  password: string;
};

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
}

// use-admin-api.ts uchun — joriy sessiya paroli (yo'q bo'lsa bo'sh string).
export function getAdminSessionPassword(): string {
  return parseSession(readRaw())?.password ?? "";
}

// ============================================================
// Global subscriber pattern — barcha komponentlar darhol sinxron
// ============================================================
const subscribers = new Set<() => void>();
let cachedRaw: string | null = null; // sof JSON snapshot — useSyncExternalStore stable bolsin

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_SESSION_KEY);
  } catch {
    return null;
  }
}

function setRaw(value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
    } else {
      window.localStorage.setItem(ADMIN_SESSION_KEY, value);
    }
  } catch (err) {
    console.warn("[admin-auth] localStorage write failed", err);
  }
  cachedRaw = value;
  subscribers.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  // Boshqa tabdan kelgan o'zgarish
  const storageHandler = (e: StorageEvent) => {
    if (e.key !== ADMIN_SESSION_KEY) return;
    cachedRaw = e.newValue;
    cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", storageHandler);
  }
  return () => {
    subscribers.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", storageHandler);
    }
  };
}

function getSnapshot(): string | null {
  // Birinchi marta cachedRaw null bolsa localStorage'dan o'qiymiz
  if (cachedRaw === null) {
    cachedRaw = readRaw();
  }
  return cachedRaw;
}

function getServerSnapshot(): string | null {
  return null; // SSR'da hech narsa yoq
}

function parseSession(raw: string | null): AdminSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) return null;
    // Eski format (parolsiz sessiya) — qayta login talab qilinadi
    if (typeof parsed.password !== "string" || !parsed.password) return null;
    return parsed as AdminSession;
  } catch {
    return null;
  }
}

// Hydration tugaganini bildiradi: SSR'da false, client'da mount'dan keyin true.
// Redirect effektlari SHU FLAG'ni kutishi kerak — aks holda SSR snapshot
// (null sessiya) asosida login sahifasiga yo'naltirib yuboradi.
const noopSubscribe = () => () => {};
export function useAdminHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// ============================================================
// Hook
// ============================================================
export function useAdminAuth() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useAdminHydrated();
  const session = parseSession(raw);

  // Parolni server'da tekshiradi. Natija:
  //   true  — to'g'ri, sessiya saqlandi
  //   false — noto'g'ri parol (401)
  //   throw — server bilan aloqa yo'q / boshqa xato (UI xabar ko'rsatadi)
  const login = useCallback(async (password: string): Promise<boolean> => {
    if (!password) return false;
    const res = await fetch(`${apiBase()}/api/admin/stats`, {
      headers: { "x-admin-password": password },
    });
    if (res.status === 401) return false;
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Server xatosi (HTTP ${res.status})`);
    }
    const now = Date.now();
    const newSession: AdminSession = {
      loginAt: now,
      expiresAt: now + SESSION_TTL_MS,
      password,
    };
    setRaw(JSON.stringify(newSession));
    return true;
  }, []);

  const logout = useCallback(() => {
    setRaw(null);
  }, []);

  return {
    isAuthenticated: session !== null,
    hydrated,
    session,
    login,
    logout,
  };
}
