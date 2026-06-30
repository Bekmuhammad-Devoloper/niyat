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
import { stopBackgroundMicAndWait } from "@/lib/hooks/use-background-mic";

type ConsumerId = string;

type MicCoordinatorAPI = {
  // Mikrofonni so'rash. BackgroundMic'ni to'liq to'xtatib qaytaradi.
  // Bir nechta consumer parallel so'rasa, faqat birinchisi await qiladi.
  request: (id: ConsumerId) => Promise<void>;
  release: (id: ConsumerId) => void;
  anyActive: boolean;
  activeConsumers: ReadonlySet<ConsumerId>;
};

const Ctx = createContext<MicCoordinatorAPI>({
  request: async () => undefined,
  release: () => undefined,
  anyActive: false,
  activeConsumers: new Set(),
});

export function MicCoordinatorProvider({ children }: { children: ReactNode }) {
  const [activeConsumers, setActiveConsumers] = useState<Set<ConsumerId>>(
    () => new Set(),
  );
  // BackgroundMic.stop() bir vaqtda bir nechta consumer chaqirsa,
  // faqat bir marta await qilamiz.
  const pendingStopRef = useRef<Promise<void> | null>(null);

  const request = useCallback(async (id: ConsumerId) => {
    setActiveConsumers((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (!pendingStopRef.current) {
      pendingStopRef.current = stopBackgroundMicAndWait().finally(() => {
        pendingStopRef.current = null;
      });
    }
    await pendingStopRef.current;
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
    () => ({ request, release, anyActive, activeConsumers }),
    [request, release, anyActive, activeConsumers],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMicCoordinator(): MicCoordinatorAPI {
  return useContext(Ctx);
}
