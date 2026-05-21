import { useState } from "react";
import { Plus } from "lucide-react";

const tabs = ["Yillik", "Oylik", "Haftalik", "Kunlik"] as const;

const goals = [
  {
    title: "Haftada 4 marta sportzal",
    why: "Tana — Alloh amonati",
    progress: 0.75,
    sub: "3/4 bajarildi",
    days: "2 kun",
  },
  {
    title: "Juz 28 ni yodlash",
    why: "Qiyomat kuni Qur'on shafoat qiladi",
    progress: 0.6,
    sub: "60% tugadi",
    days: "12 kun",
  },
  {
    title: "Frontend kursini tugatish",
    why: "Mustaqil daromad — oilam uchun",
    progress: 8 / 12,
    sub: "8/12 modul",
    days: "3 hafta",
  },
  {
    title: "Onamga har kuni qo'ng'iroq",
    why: "Vaqt o'tib ketmoqda, men sezmayapman",
    progress: 5 / 7,
    sub: "5/7 kun",
    days: "Hafta",
  },
];

export function GoalsScreen() {
  const [active, setActive] = useState<(typeof tabs)[number]>("Haftalik");
  return (
    <div className="relative h-full">
    <div className="h-full overflow-y-auto scrollbar-hide pb-28">
      <div className="px-6 pt-4 pb-2">
        <h1 className="font-serif text-[26px] text-foreground">Maqsadlar</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Niyat — amalning ruhi
        </p>
      </div>

      {/* Segmented */}
      <div className="mx-6 mt-3 grid grid-cols-4 rounded-xl bg-card border border-border p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`py-2 text-[12px] rounded-lg transition ${
              active === t
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-6 mt-5 space-y-3">
        {goals.map((g) => (
          <article
            key={g.title}
            className="rounded-2xl bg-card border border-border p-5 fade-up"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[15.5px] font-semibold text-foreground leading-snug">
                {g.title}
              </h3>
              <span className="shrink-0 text-[10px] tabular text-tertiary border border-border rounded-md px-2 py-1">
                {g.days}
              </span>
            </div>
            <p className="mt-1.5 font-serif italic text-[12.5px] text-muted-foreground">
              {g.why}
            </p>
            <div className="mt-4 h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${g.progress * 100}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-tertiary tabular">{g.sub}</p>
          </article>
        ))}
      </div>

    </div>
      <button className="absolute bottom-4 right-5 inline-flex items-center gap-2 h-12 px-5 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40 active:scale-95 transition z-30">
        <Plus size={18} /> <span className="text-[13px] font-semibold">Yangi maqsad</span>
      </button>
    </div>
  );
}
