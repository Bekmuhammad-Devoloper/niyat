// Hisobning backend'ga bog'langanligini tekshirish.
// Auth token bor → bog'langan. Yo'q → MeScreen'da sync banner ko'rsatamiz.

import { useCallback, useEffect, useState } from "react";
import { getAuthToken } from "./use-auth-api";

export function useBackendSyncCheck() {
  const [isSynced, setIsSynced] = useState<boolean>(() => !!getAuthToken());

  // Token tekshirish — har localStorage o'zgarishida
  useEffect(() => {
    const check = () => setIsSynced(!!getAuthToken());
    check();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "niyat:auth:token") check();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const refresh = useCallback(() => {
    setIsSynced(!!getAuthToken());
  }, []);

  return { isSynced, refresh };
}

// Mavjud foydalanuvchi token'siz qolib ketgan bo'lsa — avtomatik bog'lanish
// uchun login modal'ini ochish kerakligini bildiradi. Login uchun parol kerak
// — uni faqat foydalanuvchidan sorashimiz mumkin (hash dan tiklab bo'lmaydi).
//
// Bu hook har ilova ochilganda tekshiradi: agar onboarded + loggedIn lekin
// token yo'q bo'lsa, true qaytaradi. NiyatApp shuni ko'rib, modal chiqaradi.
export function useNeedsAutoSync(opts: {
  onboarded: boolean;
  loggedIn: boolean;
  phone: string;
}): boolean {
  const { isSynced } = useBackendSyncCheck();
  if (!opts.onboarded) return false;
  if (!opts.loggedIn) return false;
  if (!opts.phone) return false;
  if (isSynced) return false;
  return true;
}
