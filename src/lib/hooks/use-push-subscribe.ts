// Service Worker'ni ro'yxatdan o'tkazish va Web Push'ga subscribe qilish.
// VAPID public key serverdan olinadi. Foydalanuvchining tasdiqi (Notification
// permission) olinmasdan subscribe bo'lmaymiz.

import { useEffect } from "react";
import { getAuthToken } from "./use-auth-api";

const SW_REGISTERED_KEY = "niyat:push:sw-registered";

// Base64url → Uint8Array (VAPID public key uchun)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[push] SW register failed", err);
    return null;
  }
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    const res = await fetch(`${apiBase}/api/push/vapid-public-key`);
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey: string };
    return data.publicKey || null;
  } catch {
    return null;
  }
}

async function subscribeToPush(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    console.warn("[push] VAPID kalit sozlanmagan — server'da push yo'q");
    return false;
  }

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    try {
      const keyBytes = urlBase64ToUint8Array(publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer,
      });
    } catch (err) {
      console.warn("[push] subscribe failed", err);
      return false;
    }
  }

  // Subscription'ni server'ga jo'natamiz
  try {
    const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    const token = getAuthToken();
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const subJson = subscription.toJSON();
    await fetch(`${apiBase}/api/push/subscribe`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }),
    });
    return true;
  } catch (err) {
    console.warn("[push] subscription save failed", err);
    return false;
  }
}

export function usePushSubscribe() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Faqat bir martagina urinib ko'ramiz (notification ruxsat bo'lsa)
    const already = window.localStorage.getItem(SW_REGISTERED_KEY);
    if (already === "true") return;

    (async () => {
      const ok = await subscribeToPush();
      if (ok) {
        try {
          window.localStorage.setItem(SW_REGISTERED_KEY, "true");
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);
}
