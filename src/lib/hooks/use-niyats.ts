import { useCallback, useEffect } from "react";
import { useLocalState } from "@/lib/use-local-state";
import { initialNiyat, type NiyatItem } from "@/lib/niyat-data";

const STORAGE_KEY = "niyat:home:items";
const LEGACY_KEY = "niyat:home:niyat"; // eski (bir string) format

function newItem(text: string, createdAt: number = Date.now()): NiyatItem {
  return {
    id: `n-${createdAt}-${Math.random().toString(36).slice(2, 6)}`,
    text: text.trim(),
    createdAt,
    completedAt: null,
  };
}

export function useNiyats() {
  const [items, setItems] = useLocalState<NiyatItem[]>(STORAGE_KEY, []);

  // Bir martalik migratsiya: eski string'dan birinchi item yaratish
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (items.length > 0) return;
    try {
      const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (typeof legacy === "string" && legacy.trim()) {
          setItems([newItem(legacy.trim())]);
        }
      }
    } catch {
      /* ignore */
    }
  }, [items.length, setItems]);

  const add = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setItems((prev) => [newItem(trimmed), ...prev]);
    },
    [setItems],
  );

  const update = useCallback(
    (id: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, text: trimmed } : n)));
    },
    [setItems],
  );

  const markDone = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, completedAt: Date.now() } : n)),
      );
    },
    [setItems],
  );

  const markUndone = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, completedAt: null } : n)));
    },
    [setItems],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    [setItems],
  );

  // Aktiv niyat — bajarilmaganlardan eng yangi (Coach kontekstida ishlatish uchun)
  const activeNiyat: NiyatItem | null =
    items.find((n) => n.completedAt === null) ?? null;
  // Aktiv matn — undone bo'lganlarning matnlari qo'shilishi mumkin
  const undoneTexts = items
    .filter((n) => n.completedAt === null)
    .map((n) => n.text);

  return {
    items,
    activeNiyat,
    undoneTexts,
    add,
    update,
    markDone,
    markUndone,
    remove,
  };
}

// Onboarding'da boshlang'ich niyatni qo'shish uchun
export function seedFirstNiyat(text: string = initialNiyat) {
  if (typeof window === "undefined") return;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    const arr = existing ? (JSON.parse(existing) as NiyatItem[]) : [];
    if (arr.length === 0 && text.trim()) {
      arr.push(newItem(text));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
  } catch (err) {
    console.warn("seedFirstNiyat failed", err);
  }
}
