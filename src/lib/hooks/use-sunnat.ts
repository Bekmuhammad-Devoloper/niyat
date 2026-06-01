import { useEffect, useMemo, useState } from "react";
import { useLocalState } from "@/lib/use-local-state";
import {
  getCachedSunnats,
  loadSunnats,
  pickTodaySunnat,
  todayKey,
  type Sunnat,
} from "@/lib/data/sunnats";

export type SunnatProgress = {
  appliedByDate: Record<string, string>;
};

export function useSunnat() {
  const [progress, setProgress] = useLocalState<SunnatProgress>(
    "niyat:sunnat:progress",
    { appliedByDate: {} },
  );
  const [pool, setPool] = useState<Sunnat[] | null>(() => getCachedSunnats());

  // Birinchi mount'da kutubxonani yuklash
  useEffect(() => {
    if (pool) return;
    let active = true;
    loadSunnats()
      .then((data) => {
        if (active) setPool(data);
      })
      .catch((err) => {
        console.warn("[useSunnat] load failed:", err);
      });
    return () => {
      active = false;
    };
  }, [pool]);

  const result = useMemo(() => {
    const today = pool ? pickTodaySunnat(pool) : null;
    const key = todayKey();
    const appliedToday = today ? progress.appliedByDate[key] === today.id : false;
    const appliedDays = Object.keys(progress.appliedByDate).length;

    let streak = 0;
    const sortedDates = Object.keys(progress.appliedByDate).sort();
    if (sortedDates.length > 0) {
      const cursor = new Date();
      while (true) {
        const k = todayKey(cursor);
        if (progress.appliedByDate[k]) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return {
      today,
      pool: pool ?? [],
      appliedToday,
      appliedDays,
      streak,
      isLoading: !pool,
      total: pool?.length ?? 0,
    };
  }, [progress, pool]);

  const markApplied = (sunnat: Sunnat) => {
    const key = todayKey();
    setProgress({
      appliedByDate: { ...progress.appliedByDate, [key]: sunnat.id },
    });
  };

  const unmark = () => {
    const key = todayKey();
    const next = { ...progress.appliedByDate };
    delete next[key];
    setProgress({ appliedByDate: next });
  };

  return { ...result, markApplied, unmark };
}
