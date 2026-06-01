// Admin panel auth — sodda parol asosida (MVP).
// useSyncExternalStore bilan global localStorage'ni reaktiv kuzatadi.
// Bir komponentda login bo'lsa, boshqalari ham darhol bilishadi.

import { useCallback, useSyncExternalStore } from "react";

const ADMIN_SESSION_KEY = "niyat:admin:session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type AdminSession = {
  loginAt: number;
  expiresAt: number;
};

const ADMIN_PASSWORD =
  (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || "yuksalish2026";

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
    const parsed = JSON.parse(raw) as AdminSession;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ============================================================
// Hook
// ============================================================
export function useAdminAuth() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const session = parseSession(raw);

  const login = useCallback((password: string): boolean => {
    if (password !== ADMIN_PASSWORD) return false;
    const now = Date.now();
    const newSession: AdminSession = {
      loginAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    setRaw(JSON.stringify(newSession));
    return true;
  }, []);

  const logout = useCallback(() => {
    setRaw(null);
  }, []);

  return {
    isAuthenticated: session !== null,
    session,
    login,
    logout,
  };
}
