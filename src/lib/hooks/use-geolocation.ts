import { useCallback, useState } from "react";
import { useSettings } from "./use-settings";

export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export type GeoErrorReason =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unsupported"
  | "secure_context";

// Brauzer joylashuv API'sini chaqirish va `settings.location` ga saqlash.
// Foydalanuvchi rad etsa — settings.location = null bo'lib qoladi.
export function useGeolocation() {
  const { settings, update } = useSettings();
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<{ reason: GeoErrorReason; message: string } | null>(
    null,
  );

  const request = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setError({
        reason: "unsupported",
        message: "Brauzeringiz joylashuvni qo'llamaydi",
      });
      return false;
    }
    // HTTPS bo'lmasa, ko'p brauzer geolocation'ni rad qiladi
    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setStatus("denied");
      setError({
        reason: "secure_context",
        message: "Joylashuv faqat HTTPS sahifalarda ishlaydi",
      });
      return false;
    }

    setStatus("requesting");
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          update({
            location: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              label: "Sizning joylashuvingiz",
            },
          });
          setStatus("granted");
          setError(null);
          resolve(true);
        },
        (err) => {
          setStatus("denied");
          let reason: GeoErrorReason = "position_unavailable";
          let message = "Joylashuvni olishda xatolik";
          if (err.code === err.PERMISSION_DENIED) {
            reason = "permission_denied";
            message =
              "Joylashuv ruxsati berilmadi. Brauzer manzil chizig'i yonidagi qulf belgisini bosing → Joylashuv → Allow.";
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            reason = "position_unavailable";
            message =
              "Joylashuvni aniqlab bo'lmadi. Wi-Fi/GPS yoqilganmi tekshiring.";
          } else if (err.code === err.TIMEOUT) {
            reason = "timeout";
            message = "Vaqt tugadi. Internet aloqasini tekshirib, qayta urinib ko'ring.";
          }
          setError({ reason, message });
          console.warn("[geolocation]", err);
          resolve(false);
        },
        { timeout: 15000, maximumAge: 1000 * 60 * 60, enableHighAccuracy: false },
      );
    });
  }, [update]);

  const clear = useCallback(() => {
    update({ location: null });
    setStatus("idle");
    setError(null);
  }, [update]);

  return {
    location: settings.location,
    status,
    error,
    request,
    clear,
  };
}
