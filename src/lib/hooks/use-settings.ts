import { useCallback, useMemo } from "react";
import { useLocalState } from "@/lib/use-local-state";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";

export function useSettings() {
  const [stored, setSettings] = useLocalState<Settings>("niyat:settings", DEFAULT_SETTINGS);
  // Eski install'larda yangi kalitlar bo'lmasligi mumkin — default bilan
  // birlashtiramiz (ichki notifications/voice obyektlari ham).
  const settings = useMemo<Settings>(
    () => ({
      ...DEFAULT_SETTINGS,
      ...stored,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications ?? {}) },
      voice: { ...DEFAULT_SETTINGS.voice, ...(stored.voice ?? {}) },
    }),
    [stored],
  );

  // Qisman yangilash uchun yordamchi.
  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings],
  );

  return { settings, setSettings, update };
}
