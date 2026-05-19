import { useEffect, useState } from "react";
import { ChevronDown, Flame, Mic, Plus, Pencil, MoonStar } from "lucide-react";

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function Checkbox({ done }: { done: boolean }) {
  return (
    <span
      className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
        done ? "bg-primary border-primary" : "border-tertiary"
      }`}
    >
      {done && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.8 9L10 3" stroke="#0E1410" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export function HomeScreen() {
  const streak = useCountUp(12);
  const goals = useCountUp(4);

  const tasks = [
    { time: "06:00", label: "Bomdod namozi", done: true },
    { time: "07:30", label: "30 daqiqa Qur'on tilovati", done: true },
    { time: "10:00", label: "Frontend kursi — 2-modul", done: false, now: true },
    { time: "20:00", label: "Onaga qo'ng'iroq", done: false },
  ];

  return (
    <div className="relative h-full overflow-y-auto scrollbar-hide pb-24">
      <div className="px-6 pt-4 pb-3 fade-up">
        <h1 className="font-serif text-[28px] leading-tight text-foreground">
          Assalomu alaykum, Bek
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground tabular">
          12 Zulqada 1447 · 19 May 2026
        </p>
      </div>

      {/* Next prayer */}
      <div className="mx-6 mt-2 rounded-2xl bg-card border border-border relative overflow-hidden fade-up">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
        <div className="flex items-center justify-between p-5 pl-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
              Keyingi namoz
            </p>
            <p className="mt-2 text-[32px] font-serif leading-none text-foreground">Asr</p>
            <p className="mt-2 text-[13px] text-muted-foreground tabular">
              <span className="text-foreground">16:42</span> · 2 soat 14 daqiqada
            </p>
          </div>
          <MoonStar className="text-primary/60" size={36} strokeWidth={1.2} />
        </div>
      </div>

      {/* Niyat card */}
      <div
        className="mx-6 mt-4 rounded-2xl p-5 relative fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.10), rgba(184,166,107,0.03))",
          border: "1px solid rgba(184,166,107,0.18)",
        }}
      >
        <p className="font-serif italic text-[13px] text-primary">Bugungi niyatim</p>
        <p className="mt-3 font-serif text-[16px] leading-relaxed text-foreground">
          “Bugun telefonni soat 22:00 dan keyin qo'limga olmayman. Onamga qo'ng'iroq qilaman.”
        </p>
        <button className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition">
          <Pencil size={11} /> Tahrirlash
        </button>
      </div>

      {/* Stats */}
      <div className="mx-6 mt-4 grid grid-cols-3 gap-2 fade-up">
        <StatTile
          label="Ekran vaqti"
          value="2s 14d"
          sub={
            <span className="text-[#4A7C59] inline-flex items-center gap-0.5">
              <ChevronDown size={10} /> 32%
            </span>
          }
        />
        <StatTile
          label="Maqsadlar"
          value={`${goals}/7`}
          sub={<Ring progress={goals / 7} />}
        />
        <StatTile
          label="Streak"
          value={`${streak} kun`}
          sub={<Flame size={11} className="text-primary inline" />}
        />
      </div>

      {/* Today plan */}
      <div className="px-6 mt-6 fade-up">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">Bugungi reja</h2>
          <span className="text-[11px] text-tertiary tabular">2/4</span>
        </div>
        <ul className="mt-3 space-y-1">
          {tasks.map((t) => (
            <li
              key={t.label}
              className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-card/60 transition"
            >
              <span className="text-[11px] tabular text-tertiary mt-1 w-10 shrink-0">
                {t.time}
              </span>
              <Checkbox done={t.done} />
              <span
                className={`flex-1 text-[14px] leading-snug ${
                  t.done ? "text-tertiary line-through" : "text-foreground"
                }`}
              >
                {t.label}
              </span>
              {t.now && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-gold" />
                  Hozir vaqti
                </span>
              )}
            </li>
          ))}
          <li>
            <button className="mt-1 flex items-center gap-2 px-3 py-2 text-[13px] text-tertiary hover:text-primary transition">
              <Plus size={14} /> Vazifa qo'shish
            </button>
          </li>
        </ul>
      </div>

      {/* Floating mic */}
      <button
        className="absolute bottom-6 right-6 h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition"
        aria-label="Voice"
      >
        <Mic size={22} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-tertiary">{label}</p>
      <p className="mt-2 text-[16px] font-semibold text-foreground tabular leading-none">
        {value}
      </p>
      <div className="mt-2 text-[11px] tabular">{sub}</div>
    </div>
  );
}

function Ring({ progress }: { progress: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none" />
      <circle
        cx="10"
        cy="10"
        r={r}
        stroke="#B8A66B"
        strokeWidth="2"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        strokeLinecap="round"
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}
