import { Play, Heart } from "lucide-react";

const prayers = [
  { name: "Bomdod", time: "04:32", state: "done" },
  { name: "Peshin", time: "12:48", state: "done" },
  { name: "Asr", time: "16:42", state: "now" },
  { name: "Shom", time: "19:24", state: "next" },
  { name: "Xufton", time: "21:02", state: "next" },
];

export function WorshipScreen() {
  return (
    <div className="h-full overflow-y-auto scrollbar-hide pb-24">
      <div className="px-6 pt-4 pb-3">
        <h1 className="font-serif text-[26px] text-foreground">Ibodat</h1>
      </div>

      {/* Hero prayers */}
      <div className="mx-6 rounded-2xl bg-card border border-border p-5 geo-pattern fade-up">
        <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
          Bugungi namozlar
        </p>
        <div className="mt-4 flex justify-between">
          {prayers.map((p) => {
            const filled = p.state === "done";
            const now = p.state === "now";
            return (
              <div key={p.name} className="flex flex-col items-center gap-2">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    filled
                      ? "bg-primary"
                      : now
                      ? "ring-2 ring-primary pulse-gold"
                      : "border border-border"
                  }`}
                >
                  {filled && (
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5L4.8 9L10 3" stroke="#0E1410" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{p.name}</span>
                <span className="text-[10px] tabular text-tertiary -mt-1">{p.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quran */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Qur'on
        </h2>
        <div className="mt-3 rounded-2xl bg-card border border-border p-5">
          <p className="text-[11px] text-tertiary">Bugun</p>
          <p className="mt-1 font-serif text-[20px] text-foreground">
            Al-Mulk · 8-oyat
          </p>
          <div className="mt-3 flex items-center justify-between">
            <button className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold active:scale-95">
              <Play size={14} fill="#0E1410" /> Davom etish
            </button>
            <span className="text-[11px] tabular text-primary">🔥 23 kun</span>
          </div>
        </div>
      </section>

      {/* Memorization */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Yodlash
        </h2>
        <div className="mt-3 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-foreground">Juz 30</p>
            <p className="text-[11px] tabular text-muted-foreground">27/37 sura</p>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-elevated">
            <div className="h-full bg-primary rounded-full" style={{ width: "73%" }} />
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-wider text-tertiary">
            Bugungi takror
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["An-Nas", "Al-Falaq", "Al-Ikhlas"].map((s) => (
              <button
                key={s}
                className="rounded-xl border border-border bg-elevated/40 py-3 text-center text-[12px] text-foreground active:scale-95 transition"
              >
                <span className="font-arabic block text-quran text-[14px]">
                  {s === "An-Nas" ? "الناس" : s === "Al-Falaq" ? "الفلق" : "الإخلاص"}
                </span>
                <span className="text-[10px] text-tertiary mt-1 block">{s}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sadaqa */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Sadaqa
        </h2>
        <div className="mt-3 rounded-2xl bg-card border border-border p-5">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 31 }).map((_, i) => {
              const has = [1, 3, 4, 7, 8, 12, 15, 16, 17].includes(i);
              const today = i === 18;
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-md flex items-center justify-center text-[9px] tabular ${
                    has
                      ? "bg-primary/80 text-primary-foreground"
                      : today
                      ? "border border-primary text-primary"
                      : "bg-elevated/50 text-tertiary"
                  }`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Bugun sadaqa qilinmagan
          </p>
          <button className="mt-2 text-[12px] text-primary">+ Sadaqa bayonotini qo'shish</button>
        </div>
      </section>

      {/* Hadith */}
      <section className="px-6 mt-6 mb-2 fade-up">
        <div
          className="rounded-2xl p-5 relative"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,184,106,0.10), rgba(184,166,107,0.04))",
            border: "1px solid rgba(184,166,107,0.18)",
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-[0.2em] uppercase text-primary">
              Hadis-darmon
            </p>
            <Heart size={14} className="text-primary/70" />
          </div>
          <p className="mt-3 font-serif italic text-[15px] leading-relaxed text-foreground">
            “Eng yaxshilaringiz — ahliga eng yaxshisi bo'lganlaringizdir.”
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">Tirmiziy</p>
        </div>
      </section>
    </div>
  );
}
