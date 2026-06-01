import { useCallback } from "react";
import { useLocalState } from "@/lib/use-local-state";
import { ASMA_UL_HUSNA, type AsmaItem } from "@/lib/data/asma-ul-husna";

// Yodlangan ismlar — number (1-99) ro'yxati
export function useAsmaProgress() {
  const [memorized, setMemorized] = useLocalState<number[]>("niyat:asma:memorized", []);

  const isMemorized = useCallback(
    (n: number) => memorized.includes(n),
    [memorized],
  );

  const mark = useCallback(
    (n: number) => {
      setMemorized((prev) => (prev.includes(n) ? prev : [...prev, n]));
    },
    [setMemorized],
  );

  const unmark = useCallback(
    (n: number) => {
      setMemorized((prev) => prev.filter((x) => x !== n));
    },
    [setMemorized],
  );

  const toggle = useCallback(
    (n: number) => {
      setMemorized((prev) =>
        prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
      );
    },
    [setMemorized],
  );

  const reset = useCallback(() => setMemorized([]), [setMemorized]);

  // Keyingi yodlanmagan ismni qaytaradi — "Bugungi ism" uchun
  const nextToMemorize: AsmaItem | null =
    ASMA_UL_HUSNA.find((a) => !memorized.includes(a.number)) ?? null;

  return {
    all: ASMA_UL_HUSNA,
    memorized,
    count: memorized.length,
    total: ASMA_UL_HUSNA.length,
    isMemorized,
    mark,
    unmark,
    toggle,
    reset,
    nextToMemorize,
  };
}
