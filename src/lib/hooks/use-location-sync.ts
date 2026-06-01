// Joylashuvni doimiy kuzatib serverga yuborib turadi.
//
// Capacitor (Android APK):
//   @capacitor-community/background-geolocation plugin ishlatadi.
//   Ilova fonda turganda ham (yopiq, ekran ochiq) joylashuv kuzatiladi —
//   foreground service bildirishnoma ko'rsatib turadi ("Niyat joylashuv kuzatmoqda").
//   ACCESS_BACKGROUND_LOCATION ruxsati birinchi marta soraladi ("Always allow").
//
// Web (brauzer):
//   navigator.geolocation.watchPosition — faqat tab ochiq turganda ishlaydi.
//
// Throttling:
//   - >=50m harakat bo'lsa darhol yuboriladi
//   - Min interval 30 sek (server bombardimon qilmasligi uchun)
//   - 5 daqiqalik heartbeat (harakatsiz bo'lsa ham admin "jonli" deb belgilaydi)
//
// Cheklovlar:
//   - Faqat settings.location yoqilgan bo'lsa ishlaydi (3-marta tasdiq bilan o'chirilgan
//     bo'lsa, kuzatish to'xtaydi — foydalanuvchi xohishi hurmat qilinadi)
//   - Auth token bo'lmasa jim'cha o'tib ketadi

import { useCallback, useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { BackgroundRunner } from "@capacitor/background-runner";
import type {
  BackgroundGeolocationPlugin,
  Location as BgLocation,
  CallbackError,
} from "@capacitor-community/background-geolocation";
import { useSettings } from "./use-settings";
import { getAuthToken } from "./use-auth-api";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  "BackgroundGeolocation",
);

const RUNNER_LABEL = "uz.yuksalish.niyat.location";

const MIN_INTERVAL_MS = 30_000;
const HEARTBEAT_MS = 5 * 60_000;
const MOVE_THRESHOLD_M = 50;

const IS_NATIVE = Capacitor.isNativePlatform();

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    window.location.protocol === "https:" || h === "localhost" || h === "127.0.0.1"
  );
}

export function useLocationSync() {
  const { settings, update } = useSettings();
  const enabled = !!settings.location;
  const lastSentRef = useRef<{ lat: number; lon: number; at: number } | null>(null);

  const pushLocation = useCallback(
    (lat: number, lon: number, accuracy: number | null) => {
      const token = getAuthToken();
      if (!token) return;
      const now = Date.now();
      const last = lastSentRef.current;
      const moved =
        !last || distanceMeters(last.lat, last.lon, lat, lon) >= MOVE_THRESHOLD_M;
      const cooledDown = !last || now - last.at >= MIN_INTERVAL_MS;
      const heartbeat = !last || now - last.at >= HEARTBEAT_MS;
      if (!heartbeat && !(moved && cooledDown)) return;

      const apiBase =
        (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
      void fetch(`${apiBase}/api/profile/location`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          accuracyM: accuracy,
        }),
      })
        .then((res) => {
          if (res.ok) {
            lastSentRef.current = { lat, lon, at: Date.now() };
          }
        })
        .catch((err) => {
          console.warn("[location-sync] failed", err);
        });
    },
    [],
  );

  // ===== Background runner — har 15 daq token+apiBase sinxron =====
  // Ilova ochilgan har safarda runner KV'ga eng oxirgi auth ma'lumotlarini
  // yetkazamiz (uninstall/reinstall yoki token yangilanganda muhim).
  useEffect(() => {
    if (!IS_NATIVE) return;
    const token = getAuthToken();
    if (!token) return;
    const apiBase =
      (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    void BackgroundRunner.dispatchEvent({
      label: RUNNER_LABEL,
      event: "setup",
      details: { token, apiBase },
    }).catch((err) => {
      console.debug("[bg-runner] setup skipped", err);
    });
  }, []);

  // ===== NATIVE (Android APK) — background-geolocation plugin =====
  useEffect(() => {
    if (!IS_NATIVE) return;
    if (!enabled) return;

    let watcherId: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const id = await BackgroundGeolocation.addWatcher(
          {
            // Foreground service bildirishnomasi — Android shart qiladi
            backgroundMessage:
              "Namoz vaqtlari va juma masjid eslatmasi uchun joylashuv kuzatilmoqda",
            backgroundTitle: "Niyat — joylashuv aktiv",
            requestPermissions: true,
            stale: false,
            distanceFilter: MOVE_THRESHOLD_M,
          },
          (location: BgLocation | undefined, error: CallbackError | undefined) => {
            if (error) {
              if (error.code === "NOT_AUTHORIZED") {
                console.warn("[location-sync] ruxsat berilmadi", error);
              } else {
                console.warn("[location-sync] watch xato", error);
              }
              return;
            }
            if (!location) return;
            update({
              location: {
                latitude: location.latitude,
                longitude: location.longitude,
                label: "Sizning joylashuvingiz",
              },
            });
            pushLocation(
              location.latitude,
              location.longitude,
              location.accuracy ?? null,
            );
          },
        );
        if (cancelled) {
          await BackgroundGeolocation.removeWatcher({ id });
          return;
        }
        watcherId = id;
      } catch (err) {
        console.warn("[location-sync] plugin xato", err);
      }
    })();

    return () => {
      cancelled = true;
      if (watcherId) {
        void BackgroundGeolocation.removeWatcher({ id: watcherId });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ===== WEB (brauzer) — watchPosition (faqat tab ochiq turganda) =====
  useEffect(() => {
    if (IS_NATIVE) return;
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (!isSecureContext()) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        update({
          location: {
            latitude,
            longitude,
            label: "Sizning joylashuvingiz",
          },
        });
        pushLocation(latitude, longitude, accuracy);
      },
      (err) => {
        console.warn("[location-sync] watch error", err.message);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 30_000,
      },
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ===== Heartbeat — 5 daqiqalik mavjudlik signali (ikkala platforma uchun) =====
  // watchPosition/plugin harakatsiz holatda jim turishi mumkin — bunda admin "jonli"
  // ekanini ko'ra olmaydi. Shu sababli har 5 daqiqada eng oxirgi koordinatani
  // qayta yuboramiz (heartbeat).
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const loc = settings.location;
    if (!loc) return;

    // Ilova ochilgan paytda darhol bir marta
    pushLocation(loc.latitude, loc.longitude, null);

    const id = window.setInterval(() => {
      const cur = settings.location;
      if (!cur) return;
      pushLocation(cur.latitude, cur.longitude, null);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
