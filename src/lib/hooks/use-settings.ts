import { useCallback } from "react";
import { useLocalState } from "@/lib/use-local-state";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";

export function useSettings() {
  const [settings, setSettings] = useLocalState<Settings>("niyat:settings", DEFAULT_SETTINGS);

  // Qisman yangilash uchun yordamchi.
  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings],
  );

  return { settings, setSettings, update };
}
