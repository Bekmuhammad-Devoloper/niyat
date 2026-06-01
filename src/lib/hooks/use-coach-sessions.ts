// Murabbiy suhbatlari tarixini boshqarish — bir nechta sessiyani saqlash,
// aktiv sessiyani almashtirish, eski sessiyalarni ko'rib chiqish.
//
// Saqlash modeli:
//   niyat:coach:sessions  — barcha sessiyalar (eng yangisi birinchi)
//   niyat:coach:activeId  — hozir ochiq sessiya id'si
//
// Eski tartib (niyat:coach:messages) avtomatik bitta sessiyaga ko'chiriladi.

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type CoachMessage,
  initialCoachMessages,
} from "@/lib/niyat-data";
import { useLocalState } from "@/lib/use-local-state";

export type ChatSession = {
  id: string;
  title: string;
  messages: CoachMessage[];
  createdAt: number;
  updatedAt: number;
};

const MAX_TITLE_LEN = 48;

function makeId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function deriveTitle(messages: CoachMessage[]): string {
  const firstUser = messages.find((m) => m.from === "user");
  if (!firstUser) return "Yangi suhbat";
  const txt = firstUser.text.trim().replace(/\s+/g, " ");
  if (txt.length <= MAX_TITLE_LEN) return txt;
  return txt.slice(0, MAX_TITLE_LEN - 1).trimEnd() + "…";
}

function makeFreshSession(): ChatSession {
  const now = Date.now();
  return {
    id: makeId(),
    title: "Yangi suhbat",
    messages: initialCoachMessages,
    createdAt: now,
    updatedAt: now,
  };
}

// Eski `niyat:coach:messages` qiymatini bitta sessiyaga aylantiramiz —
// foydalanuvchi yangilashdan oldin yozgan xabarlari yo'qolmasligi uchun.
function migrateLegacyMessages(): ChatSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("niyat:coach:messages");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoachMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const createdAt = parsed[0]?.createdAt ?? Date.now();
    const updatedAt = parsed[parsed.length - 1]?.createdAt ?? createdAt;
    return {
      id: makeId(),
      title: deriveTitle(parsed),
      messages: parsed,
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function useCoachSessions() {
  const [sessions, setSessions] = useLocalState<ChatSession[]>(
    "niyat:coach:sessions",
    [],
  );
  const [activeId, setActiveId] = useLocalState<string>(
    "niyat:coach:activeId",
    "",
  );
  const migratedRef = useRef(false);

  // Birinchi marta yuklashda: eski xabarlarni ko'chirish + bo'sh bo'lsa,
  // yangi sessiya yaratish.
  useEffect(() => {
    if (migratedRef.current) return;
    if (typeof window === "undefined") return;
    if (sessions.length > 0) {
      migratedRef.current = true;
      // Eski xabarlar hali ham bo'lsa, tozalab tashlaymiz (bir marta).
      try {
        window.localStorage.removeItem("niyat:coach:messages");
      } catch {
        /* ignore */
      }
      return;
    }
    migratedRef.current = true;
    const legacy = migrateLegacyMessages();
    if (legacy) {
      setSessions([legacy]);
      setActiveId(legacy.id);
      try {
        window.localStorage.removeItem("niyat:coach:messages");
      } catch {
        /* ignore */
      }
      return;
    }
    const fresh = makeFreshSession();
    setSessions([fresh]);
    setActiveId(fresh.id);
  }, [sessions.length, setSessions, setActiveId]);

  const activeSession = useMemo<ChatSession | null>(() => {
    if (sessions.length === 0) return null;
    const found = sessions.find((s) => s.id === activeId);
    return found ?? sessions[0];
  }, [sessions, activeId]);

  // Aktiv sessiyaga xabarlar to'plamini yozish — har send'dan keyin chaqiriladi.
  const setActiveMessages = useCallback(
    (updater: (prev: CoachMessage[]) => CoachMessage[]) => {
      setSessions((prev) => {
        if (prev.length === 0) return prev;
        const targetId = prev.find((s) => s.id === activeId)?.id ?? prev[0].id;
        return prev.map((s) => {
          if (s.id !== targetId) return s;
          const nextMessages = updater(s.messages);
          return {
            ...s,
            messages: nextMessages,
            title:
              s.title === "Yangi suhbat" || s.title.length === 0
                ? deriveTitle(nextMessages)
                : s.title,
            updatedAt: Date.now(),
          };
        });
      });
    },
    [activeId, setSessions],
  );

  // Yangi bo'sh sessiya — eski'lari saqlanib qoladi.
  const newSession = useCallback(() => {
    const fresh = makeFreshSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    return fresh.id;
  }, [setSessions, setActiveId]);

  const switchSession = useCallback(
    (id: string) => {
      setActiveId(id);
    },
    [setActiveId],
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const fresh = makeFreshSession();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (activeId === id) setActiveId(next[0].id);
        return next;
      });
    },
    [activeId, setSessions, setActiveId],
  );

  // Aktiv sessiya xabarlarini boshlang'ich holatga qaytarish (xuddi avvalgi
  // "Suhbatni qaytadan boshlash" tugmasi kabi) — sessiya qoladi, lekin tozalanadi.
  const resetActive = useCallback(() => {
    setActiveMessages(() => initialCoachMessages);
  }, [setActiveMessages]);

  // Sessiyalar ro'yxati har doim eng oxirgi yangilanish bo'yicha tartiblangan.
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  return {
    sessions: sortedSessions,
    activeSession,
    activeId: activeSession?.id ?? "",
    messages: activeSession?.messages ?? initialCoachMessages,
    setActiveMessages,
    newSession,
    switchSession,
    deleteSession,
    resetActive,
  };
}
