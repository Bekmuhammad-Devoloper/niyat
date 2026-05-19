import { ChevronRight, LogOut } from "lucide-react";

function GeoAvatarLg() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <defs>
        <linearGradient id="gal" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#D4B86A" />
          <stop offset="1" stopColor="#7A6738" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="70" height="70" rx="20" fill="#1A211C" stroke="rgba(184,166,107,0.3)" />
      <g stroke="url(#gal)" strokeWidth="1.3" fill="none">
        <polygon points="36,10 58,22 58,50 36,62 14,50 14,22" />
        <polygon points="36,18 50,26 50,46 36,54 22,46 22,26" />
        <circle cx="36" cy="36" r="6" fill="url(#gal)" />
        <line x1="36" y1="10" x2="36" y2="18" />
        <line x1="36" y1="54" x2="36" y2="62" />
      </g>
    </svg>
  );
}

const stats = [
  { label: "Streak rekordi", value: "47 kun" },
  { label: "Ekran vaqti tejaldi", value: "127 soat" },
  { label: "Bajarilgan maqsadlar", value: "89" },
  { label: "Qur'on o'qildi", value: "14 marta xatm" },
];

const menu = [
  "AI shaxsiyati",
  "Bildirishnomalar",
  "Namoz sozlamalari",
  "Ovoz va til",
  "Maxfiylik",
  "Premium obuna",
  "Yordam",
];

export function MeScreen() {
  return (
    <div className="h-full overflow-y-auto scrollbar-hide pb-24">
      <div className="px-6 pt-6 flex items-center gap-4 fade-up">
        <GeoAvatarLg />
        <div className="min-w-0">
          <p className="text-[18px] font-semibold text-foreground">Bek Aliyev</p>
          <p className="text-[12px] text-primary mt-0.5">Inson 2.3 darajasi</p>
          <div className="mt-2 h-1.5 w-40 rounded-full bg-elevated overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "62%" }} />
          </div>
          <p className="text-[10px] text-tertiary mt-1 tabular">v2.4 ga 340 ball</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-6 mt-6 grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border p-4">
            <p className="text-[10px] uppercase tracking-wider text-tertiary">
              {s.label}
            </p>
            <p className="mt-2 text-[18px] font-semibold tabular text-foreground">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Year summary */}
      <button
        className="mx-6 mt-5 rounded-2xl p-5 flex items-center justify-between w-[calc(100%-3rem)] text-left active:scale-[0.99] transition fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.16), rgba(184,166,107,0.04))",
          border: "1px solid rgba(184,166,107,0.25)",
        }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-wider text-primary">
            Yillik xulosa
          </p>
          <p className="mt-1 font-serif text-[20px] text-foreground">
            2026 yilingiz hozircha...
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Wrapped-style hisobot
          </p>
        </div>
        <span className="font-serif text-[44px] text-primary/40 leading-none tabular">26</span>
      </button>

      {/* Menu */}
      <ul className="mx-6 mt-5 rounded-2xl bg-card border border-border overflow-hidden">
        {menu.map((m, i) => (
          <li key={m}>
            <button className="w-full flex items-center justify-between px-5 py-3.5 text-[14px] text-foreground hover:bg-elevated/50 transition">
              <span>{m}</span>
              <ChevronRight size={16} className="text-tertiary" />
            </button>
            {i < menu.length - 1 && <div className="h-px bg-border mx-5" />}
          </li>
        ))}
      </ul>

      <button className="mt-5 mx-auto flex items-center gap-2 text-[12px] text-tertiary py-2">
        <LogOut size={13} /> Chiqish
      </button>
    </div>
  );
}
