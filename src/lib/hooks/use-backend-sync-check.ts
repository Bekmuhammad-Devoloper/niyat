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

// Avval — token yo'q bo'lsa "Markaziy serverga bog'lanish" modali chiqardi
// va foydalanuvchidan parolni qayta so'rardi. Bu UX'ni buzar edi.
//
// Endi modal yo'q. Onboarding paytida foydalanuvchi avtomatik backend'ga
// ro'yxatdan o'tadi (NiyatApp ichidagi `auth.register` chaqiriqi). Eski
// foydalanuvchilar tokensiz qolsa, MeScreen'dagi banner orqali xohlaganda
// qo'lda sinxronlash mumkin. Ilovaning asosiy funksiyalari offline ham
// ishlayveradi.
//
// Shu sababli bu hook har doim `false` qaytaradi — avto-modal o'chirilgan.
export function useNeedsAutoSync(_opts: {
  onboarded: boolean;
  loggedIn: boolean;
  phone: string;
}): boolean {
  return false;
}
