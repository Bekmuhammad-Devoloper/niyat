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

// SSR-safe localStorage state.
// - Birinchi render ham serverda, ham clientda defaultValue qaytaradi —
//   hydration mismatch'ni oldini olish uchun.
// - Mount'dan keyin useEffect ichida localStorage'dan haqiqiy qiymat o'qiladi.
// - Bir tab ichida bir xil key bilan ishlatilgan instansiyalar avtomatik sinxron.
// - Boshqa tablar'dan kelgan o'zgarish ham `storage` event orqali kuzatiladi.
export function useLocalState<T>(key: string, defaultValue: T) {
  // Birinchi render har doim defaultValue — bu SSR HTML bilan mos keladi.
  // localStorage'dan o'qish faqat client'da mount'dan keyin sodir bo'ladi
  // (pastdagi useEffect'da).
  const [value, setValue] = useState<T>(defaultValue);
  const hydrated = useRef(false);
  const localListenerRef = useRef<Listener | null>(null);

  // Mount: localStorage'dan o'qish + listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    hydrated.current = true;

    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch (err) {
      console.warn(`useLocalState: read failed for "${key}"`, err);
    }

    const listener: Listener = (raw) => {
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
        // Side effects (localStorage va boshqa instansiyalarga notify) —
        // setTimeout orqali joriy React work-loop tugashidan keyin bajariladi.
        // queueMicrotask concurrent rendering paytida render fazasida ishga
        // tushishi mumkin va "Cannot update component while rendering"
        // ogohlantirishini berishi mumkin; setTimeout(0) bu xavfdan xoli.
        if (typeof window !== "undefined" && hydrated.current) {
          setTimeout(() => {
            try {
              const raw = JSON.stringify(next);
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

  return [value, setStored] as const;
}
