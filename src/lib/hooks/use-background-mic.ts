// Orqa fon mikrofon — ilova yopiq paytda ham eshitib turadi.
//
// Faqat APK (Android) da ishlaydi. Web'da hech narsa qilmaydi.
// Custom native plugin (BackgroundMic) Java tarafda ishlaydi:
//   - Foreground service ishga tushadi (FOREGROUND_SERVICE_MICROPHONE)
//   - Bildirishnoma chiqadi ("Niyat — mikrofon yoqilgan") — swipe qilib bo'lmaydi
//   - SpeechRecognizer doimiy ravishda tinglaydi va matnga aylantiradi
//   - Transkriptlar SharedPreferences'ga saqlanadi (oxirgi 200 ta)
//   - Telefon qayta yuklangach BootReceiver service'ni qayta yoqadi
//
// Token sarflanmaydi — bu lokal STT (Android'ning ozining SpeechRecognizer'i).

import { useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

interface BackgroundMicPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<{ running: boolean }>;
  getTranscripts(): Promise<{ transcripts: string }>;
  clearTranscripts(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<{ alreadyExempt: boolean }>;
  openAppSettings(): Promise<void>;
  disableAutoRevoke(): Promise<void>;
  saveAuth(opts: { token: string | null; apiBase: string }): Promise<void>;
  checkMicPermission(): Promise<{ microphone: PermissionStateName }>;
  requestMicPermission(): Promise<{ microphone: PermissionStateName }>;
}

export type PermissionStateName = "granted" | "denied" | "prompt" | "prompt-with-rationale";

export type EnsureMicResult = {
  state: PermissionStateName;
  granted: boolean;
};

const BackgroundMic = registerPlugin<BackgroundMicPlugin>("BackgroundMic");

// NiyatApp openVoice() shu metodni await qiladi — BackgroundMic'ni to'liq
// to'xtatib voice mode'ni ochish uchun. Plugin endi MicService.instance ==
// null bo'lguncha polling qilib qaytadi (1000ms + 150ms buffer max), shu
// sabab JS await voice mode getUserMedia'dan oldin mikrofon bo'sh bo'ladi.
export async function stopBackgroundMicAndWait(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await BackgroundMic.stop();
  } catch (err) {
    console.debug("[bg-mic] stopAndWait failed", err);
  }
}

// Mikrofon ruxsatini majburiy ravishda olishga harakat qilamiz.
// 1) Native (APK): Plugin orqali Capacitor permission system'ni chaqiramiz —
//    bu OS RECORD_AUDIO dialog'ini ko'rsatishi kafolatlangan.
// 2) Web/fallback: navigator.mediaDevices.getUserMedia bilan brauzer dialog
//    chiqariladi, keyin stream darhol to'xtatamiz.
//
// Voice mode va Coach mic getUserMedia'ni chaqirishdan oldin shu helper'ni
// ishlatadi — aks holda WebChromeClient ba'zan OS dialog'ni o'tkazib yuborib,
// getUserMedia "Could not start audio source" yoki "not-allowed" beradi.
export async function ensureMicPermission(): Promise<EnsureMicResult> {
  // 1) Native — Capacitor permission system
  if (IS_NATIVE) {
    try {
      const check = await BackgroundMic.checkMicPermission();
      if (check.microphone === "granted") {
        return { state: "granted", granted: true };
      }
      const req = await BackgroundMic.requestMicPermission();
      return { state: req.microphone, granted: req.microphone === "granted" };
    } catch (err) {
      console.warn("[ensure-mic] native plugin failed", err);
      // Fallback: getUserMedia
    }
  }
  // 2) Web yoki fallback — getUserMedia bilan dialog chiqarish
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return { state: "denied", granted: false };
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Darhol to'xtatamiz — bu faqat permission trigger uchun edi
    stream.getTracks().forEach((t) => t.stop());
    return { state: "granted", granted: true };
  } catch (err) {
    const e = err as Error & { name?: string };
    if (e?.name === "NotAllowedError") {
      return { state: "denied", granted: false };
    }
    // NotReadableError yoki boshqa — ruxsat bor lekin mic band
    console.warn("[ensure-mic] getUserMedia failed", err);
    return { state: "denied", granted: false };
  }
}

// Foydalanuvchini Android Settings → Niyat ga jonatish (qo'lda ruxsat berish uchun).
export async function openMicPermissionSettings(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await BackgroundMic.openAppSettings();
  } catch (err) {
    console.warn("[ensure-mic] openAppSettings failed", err);
  }
}

const IS_NATIVE = Capacitor.isNativePlatform();

export type Transcript = { text: string; at: number };

// Mikrofon ruxsati grant qilinganmi tekshirish. APK Android WebView'da
// `navigator.permissions.query` ishlaydi.
async function hasMicPermission(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  // 1) Permissions API orqali (eng aniq)
  try {
    const perms = (navigator as Navigator & {
      permissions?: { query: (q: { name: string }) => Promise<{ state: string }> };
    }).permissions;
    if (perms && typeof perms.query === "function") {
      const res = await perms.query({ name: "microphone" });
      if (res.state === "granted") return true;
      if (res.state === "denied") return false;
      // "prompt" — hali so'ralmagan, false qaytaramiz (avto-start xohlamaymiz)
      return false;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function useBackgroundMic(enabled: boolean) {
  useEffect(() => {
    if (!IS_NATIVE) return;

    if (!enabled) {
      // Service'ni to'xtatishni await qilamiz — voice mode'da mikrofonni
      // erkin qoldirish uchun. stop() resolve qilsa ham, SpeechRecognizer
      // AudioRecord'ni async tarzda ozod qiladi (~100-300ms).
      void (async () => {
        try {
          await BackgroundMic.stop();
        } catch {
          /* plugin yo'q yoki crash — jim o'tib ketamiz */
        }
      })();
      return;
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const tryStart = async () => {
      if (cancelled) return;
      // Avval mikrofon ruxsati grant qilinganmi tekshiramiz. Ruxsat yo'q
      // bo'lsa, foreground service ochish Android 14+ da SecurityException
      // beradi va ilova crash bo'ladi. Ruxsat foydalanuvchi voice mode'ni
      // ochganda so'raladi.
      const granted = await hasMicPermission();
      if (!granted) {
        // 5 soniyadan keyin qayta tekshiramiz — foydalanuvchi voice mode
        // ochib mikrofon ruxsatini bersa, biz darhol ulanamiz.
        retryTimer = window.setTimeout(() => void tryStart(), 5000);
        return;
      }
      try {
        await BackgroundMic.start().catch((err) => {
          console.debug("[bg-mic] start failed (yumshoq)", err);
        });
        const token = window.localStorage.getItem("niyat:auth:token");
        const apiBase =
          (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
        void BackgroundMic.saveAuth({ token, apiBase }).catch(() => {});
      } catch (err) {
        console.warn("[bg-mic] plugin chaqiruv xatosi (yumshoq)", err);
      }
    };

    // 3 sekund kuting — MainApp UI to'liq mount bo'lsin
    const startTimer = window.setTimeout(() => void tryStart(), 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [enabled]);
}

export async function getBackgroundTranscripts(): Promise<Transcript[]> {
  if (!IS_NATIVE) return [];
  try {
    const res = await BackgroundMic.getTranscripts();
    return JSON.parse(res.transcripts) as Transcript[];
  } catch {
    return [];
  }
}

export async function clearBackgroundTranscripts(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await BackgroundMic.clearTranscripts();
  } catch {
    /* ignore */
  }
}

export async function isBackgroundMicRunning(): Promise<boolean> {
  if (!IS_NATIVE) return false;
  try {
    const res = await BackgroundMic.isRunning();
    return res.running;
  } catch {
    return false;
  }
}

// Web tarafdan ham heartbeat yuborish — APK bolmagan paytda admin bilsin
// mikrofon ishlayotganini. 30 sekundlik throttle.
let lastHeartbeatAt = 0;
export async function sendMicHeartbeat(text?: string): Promise<void> {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastHeartbeatAt < 30_000) return;
  const token = window.localStorage.getItem("niyat:auth:token");
  if (!token) return;
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
  try {
    const res = await fetch(`${apiBase}/api/profile/mic-heartbeat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: text?.slice(0, 200) ?? "" }),
    });
    if (res.ok) lastHeartbeatAt = now;
  } catch (err) {
    console.debug("[mic-heartbeat] failed", err);
  }
}

// Foydalanuvchini telefon Settings → Niyat ga jonatish — manufacturer (Xiaomi,
// Huawei...) ozgartirish kerak bolgan agressiv battery saver uchun.
export async function openBackgroundMicSettings(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await BackgroundMic.openAppSettings();
  } catch (err) {
    console.warn("[bg-mic] openAppSettings", err);
  }
}

// Foydalanuvchi qayta battery exempt so'rovi chiqarishi mumkin (sozlamadan)
export async function requestBatteryExempt(): Promise<boolean> {
  if (!IS_NATIVE) return true;
  try {
    const res = await BackgroundMic.requestIgnoreBatteryOptimizations();
    return res.alreadyExempt;
  } catch {
    return false;
  }
}

// Android 11+ "Auto-revoke" — uzoq ishlatilmagan ilovalardan ruxsatlar olib qoyiladi.
// Mikrofon doimiy ishlashi uchun bunni o'chirish kerak. Bu metod foydalanuvchini
// Settings → App permissions ga jonatadi.
export async function disableAutoRevoke(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await BackgroundMic.disableAutoRevoke();
  } catch (err) {
    console.warn("[bg-mic] disableAutoRevoke", err);
  }
}
