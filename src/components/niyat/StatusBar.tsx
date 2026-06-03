import { useEffect, useState } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";

// Mobil APK'da telefon o'zining haqiqiy status bar'ini ko'rsatadi
// (soat, signal, batareya). Shu sababli simulyatsiya qilinganini yashiramiz.
// Web/desktop preview'da esa telefon ramkasi ichida soat ko'rinishi kerak.
const IS_MOBILE_APP =
  (import.meta.env.VITE_IS_MOBILE as boolean | undefined) === true;

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// SSR'da neutral "—:—" ko'rinadi, client mount'idan keyin haqiqiy soat.
// Bu hidratsiya mismatch'ini oldini oladi.
function useClock(): string | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now ? formatTime(now) : null;
}

export function StatusBar() {
  const time = useClock();
  if (IS_MOBILE_APP) return null;
  return (
    <div className="flex items-center justify-between px-8 pt-3 pb-1 text-[12px] text-foreground tabular font-medium">
      <span aria-label="Hozirgi vaqt">{time ?? "—:—"}</span>
      <div className="flex items-center gap-1 opacity-80" aria-hidden>
        <Signal size={14} />
        <Wifi size={14} />
        <BatteryFull size={16} />
      </div>
    </div>
  );
}
