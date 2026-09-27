import { useCallback, useEffect, useRef, useState } from "react";

// Bitta tab ichida bir nechta useLocalState instansiyalarini sinxronlash uchun
// shaxsiy event emitter. Storage event'i faqat boshqa tablar uchun ishlaydi.
type Listener = (raw: string | null) => void;
const listeners = new Map<string, Set<Listener>>();

function notify(key: string, raw: string | null, exclude?: Listener) {
  const subs = listeners.get(key);
  if (!subs) return;
  subs.forEach((fn) => {
    if (fn !== exclude) fn(raw);
  });
}

// localStorage'ga hook'dan tashqarida yozish (masalan, serverdan profil
// tiklashda). Yozadi VA shu key bilan mount bo'lgan barcha useLocalState
// instansiyalarini darhol yangilaydi — sahifani reload qilish shart emas.
export function writeLocalState<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(value);
    window.localStorage.setItem(key, raw);
    notify(key, raw);
  } catch (err) {
    console.warn(`writeLocalState: write failed for "${key}"`, err);
  }
}

// Hook'dan tashqarida o'qish — migratsiya effektlari uchun. Xom (raw) qiymat
// null bo'lsa — hech qachon saqlanmagan.
export function readLocalStateRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// SSR-safe localStorage state.
// - Birinchi render ham serverda, ham clientda defaultValue qaytaradi —
//   hydration mismatch'ni oldini olish uchun.
// - Mount'dan keyin useEffect ichida localStorage'dan haqiqiy qiymat o'qiladi.
// - Bir tab ichida bir xil key bilan ishlatilgan instansiyalar avtomatik sinxron.
// - Boshqa tablar'dan kelgan o'zgarish ham `storage` event orqali kuzatiladi.
// - Uchinchi qaytariladigan qiymat `hydrated` — localStorage o'qilib bo'lgach
//   true bo'ladi. Migratsiya/seed effektlari SHU FLAG'ni kutishi shart, aks
//   holda birinchi render'dagi defaultValue asosida saqlangan ma'lumot ustiga
//   yozib yuboradi (ma'lumot yo'qolishi).
export function useLocalState<T>(key: string, defaultValue: T) {
  // Birinchi render har doim defaultValue — bu SSR HTML bilan mos keladi.
  // localStorage'dan o'qish faqat client'da mount'dan keyin sodir bo'ladi
  // (pastdagi useEffect'da).
  const [value, setValue] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const hydrated = useRef(false);
  const localListenerRef = useRef<Listener | null>(null);
  // Oxirgi ko'rilgan xom (raw) qiymat — bir xil raw kelsa qayta parse qilib
  // yangi obyekt yaratmaymiz (aks holda consumer'lar keraksiz re-render bo'ladi
  // va effect'lar bir-birini cheksiz uyg'otishi mumkin).
  const lastRawRef = useRef<string | null>(null);

  // Mount: localStorage'dan o'qish + listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    hydrated.current = true;

    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        lastRawRef.current = raw;
        setValue(JSON.parse(raw) as T);
      }
    } catch (err) {
      console.warn(`useLocalState: read failed for "${key}"`, err);
    }
    // setValue bilan bir batch'da — consumer'lar hydrated=true ni faqat
    // haqiqiy qiymat bilan birga ko'radi.
    setIsHydrated(true);

    const listener: Listener = (raw) => {
      if (raw === lastRawRef.current) return; // o'zgarish yo'q
      lastRawRef.current = raw;
      if (raw === null) {
        setValue(defaultValue);
        return;
      }
      try {
        setValue(JSON.parse(raw) as T);
      } catch {
        // ignore corrupted
      }
    };
    localListenerRef.current = listener;
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(listener);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.storageArea !== window.localStorage) return;
      listener(e.newValue);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.get(key)?.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
    // defaultValue ataylab dep emas: birinchi mount'dagi qiymati barcha
    // umrida amal qiladi. Aksincha bo'lsa cheksiz loop boshlanadi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStored = useCallback<typeof setValue>(
    (updater) => {
      setValue((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: T) => T)(prev)
            : updater;
        // Updater `prev`ni o'zgarishsiz qaytarsa — HECH QANDAY side effect yo'q.
        // Aks holda localStorage'ga yozish + notify boshqa instansiyalarni
        // yangi obyekt bilan re-render qiladi, ular effect'larida yana
        // setState chaqiradi va cheksiz ping-pong boshlanadi ("Maximum update
        // depth exceeded"; appTime.setActiveScreen shu tarzda loop bo'lardi).
        if (Object.is(next, prev)) return prev;
        // Side effects (localStorage va boshqa instansiyalarga notify) —
        // setTimeout orqali joriy React work-loop tugashidan keyin bajariladi.
        // queueMicrotask concurrent rendering paytida render fazasida ishga
        // tushishi mumkin va "Cannot update component while rendering"
        // ogohlantirishini berishi mumkin; setTimeout(0) bu xavfdan xoli.
        if (typeof window !== "undefined" && hydrated.current) {
          setTimeout(() => {
            try {
              const raw = JSON.stringify(next);
              if (raw === lastRawRef.current) return; // mazmunan o'zgarmagan
              lastRawRef.current = raw;
              window.localStorage.setItem(key, raw);
              notify(key, raw, localListenerRef.current ?? undefined);
            } catch (err) {
              console.warn(`useLocalState: write failed for "${key}"`, err);
            }
          }, 0);
        }
        return next;
      });
    },
    [key],
  );

  return [value, setStored, isHydrated] as const;
}
