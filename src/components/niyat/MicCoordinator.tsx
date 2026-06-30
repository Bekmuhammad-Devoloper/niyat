// Markazlashgan mikrofon koordinatori — ilova ichidagi har bir komponent
// (voice mode, coach mic, kelajakda yana) BackgroundMic foreground service'ni
// avtomatik pauza qilishi va voice consumer'lar bir-biriga xalal bermasligi
// uchun.
//
// Foydalanish:
//   const { request, release, anyActive } = useMicCoordinator();
//   useEffect(() => {
//     if (!micActive) return;
//     void request("coach");
//     return () => release("coach");
//   }, [micActive]);
//
// NiyatApp `useBackgroundMic(... && !anyActive)` bilan gate qiladi.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  stopBackgroundMicAndWait,
  ensureMicPermission,
} from "@/lib/hooks/use-background-mic";

type ConsumerId = string;

type MicCoordinatorAPI = {
  // Mikrofonni so'rash.
  //   1) AVVAL OS RECORD_AUDIO ruxsatini olamiz (dialog ko'rinadi)
  //   2) Keyin BackgroundMic foreground service'ni to'liq to'xtatamiz
  // Qaytadan: ruxsat olingan bo'lsa true, aks holda false.
  // Bir nechta consumer parallel so'rasa, faqat birinchisi await qiladi.
  request: (id: ConsumerId) => Promise<boolean>;
  release: (id: ConsumerId) => void;
  anyActive: boolean;
  activeConsumers: ReadonlySet<ConsumerId>;
  // So'nggi ruxsat holati — UI'da denial'ni ko'rsatish uchun
  lastPermissionState: "granted" | "denied" | "prompt" | "prompt-with-rationale" | "unknown";
};

const Ctx = createContext<MicCoordinatorAPI>({
  request: async () => false,
  release: () => undefined,
  anyActive: false,
  activeConsumers: new Set(),
  lastPermissionState: "unknown",
});

export function MicCoordinatorProvider({ children }: { children: ReactNode }) {
  const [activeConsumers, setActiveConsumers] = useState<Set<ConsumerId>>(
    () => new Set(),
  );
  const [lastPermissionState, setLastPermissionState] = useState<
    MicCoordinatorAPI["lastPermissionState"]
  >("unknown");
  // BackgroundMic.stop() bir vaqtda bir nechta consumer chaqirsa,
  // faqat bir marta await qilamiz.
  const pendingStopRef = useRef<Promise<void> | null>(null);
  const pendingPermRef = useRef<Promise<boolean> | null>(null);

  const request = useCallback(async (id: ConsumerId): Promise<boolean> => {
    // 1) Avval OS RECORD_AUDIO ruxsatini olamiz — dialog ko'rinishi
    //    kafolatlangan bo'lishi uchun Capacitor permission system ishlatiladi
    if (!pendingPermRef.current) {
      pendingPermRef.current = ensureMicPermission()
        .then((res) => {
          setLastPermissionState(res.state);
          return res.granted;
        })
        .finally(() => {
          pendingPermRef.current = null;
        });
    }
    const granted = await pendingPermRef.current;
    if (!granted) {
      return false;
    }
    // 2) BackgroundMic'ni to'liq to'xtatamiz
    if (!pendingStopRef.current) {
      pendingStopRef.current = stopBackgroundMicAndWait().finally(() => {
        pendingStopRef.current = null;
      });
    }
    await pendingStopRef.current;
    // 3) Consumer'ni ro'yxatga qo'shamiz
    setActiveConsumers((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    return true;
  }, []);

  const release = useCallback((id: ConsumerId) => {
    setActiveConsumers((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const anyActive = activeConsumers.size > 0;

  const value = useMemo<MicCoordinatorAPI>(
    () => ({
      request,
      release,
      anyActive,
      activeConsumers,
      lastPermissionState,
    }),
    [request, release, anyActive, activeConsumers, lastPermissionState],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMicCoordinator(): MicCoordinatorAPI {
  return useContext(Ctx);
}
