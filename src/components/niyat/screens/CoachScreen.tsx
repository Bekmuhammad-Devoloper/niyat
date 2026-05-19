import { MoreHorizontal, Mic, Send } from "lucide-react";

function GeoAvatar({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0">
      <defs>
        <linearGradient id="ga" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#D4B86A" />
          <stop offset="1" stopColor="#8C7A47" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="12" fill="#1A211C" stroke="rgba(184,166,107,0.3)" />
      <g stroke="url(#ga)" strokeWidth="1.2" fill="none">
        <polygon points="20,7 31,13.5 31,26.5 20,33 9,26.5 9,13.5" />
        <polygon points="20,12 27,16 27,24 20,28 13,24 13,16" />
        <circle cx="20" cy="20" r="3" fill="url(#ga)" />
      </g>
    </svg>
  );
}

const messages = [
  {
    from: "coach",
    text: `Bek, bugun yaxshi boshlanding. Bomdodga vaqtida turding — bu 5-kun ketma-ket. Lekin men ko'ryapmanki, soat 6:47 da Instagram ochding va 23 daqiqa qoldim. Nima bo'ldi?`,
  },
  {
    from: "user",
    text: "Zerikkan edim, bomdoddan keyin uyqu kelmay turardi",
  },
  {
    from: "coach",
    text:
      "Tushunaman. Bomdoddan keyin tana faol, lekin miya hali joyiga kelmagan — bu tabiiy. Lekin Instagram bu vaqtda eng yomon tanlov, chunki dofamin urib ketib, keyin butun kun pasaytirib qo'yadi.\n\nErtaga shu vaqt uchun nima qilamiz? 3 ta variant beraman:\n• 15 daqiqa Qur'on tilovati (eng yaxshi)\n• Yengil yurish — 20 daqiqa havoda\n• Kitob — ozgina, 10-bet",
  },
];

const chips = ["Qur'on tilovati", "Yurish", "Kitob", "O'zim tanlayman"];

export function CoachScreen() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <GeoAvatar size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground leading-tight">Murabbiy</p>
          <p className="text-[11px] text-tertiary leading-tight mt-0.5">
            Sizni 47 kundan beri taniydi
          </p>
        </div>
        <button className="text-muted-foreground p-1">
          <MoreHorizontal size={20} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-5 space-y-5">
        {messages.map((m, i) =>
          m.from === "coach" ? (
            <div key={i} className="fade-up">
              <div className="pl-4 border-l-[3px] border-primary">
                <p className="text-[14.5px] leading-relaxed text-foreground whitespace-pre-line">
                  {m.text}
                </p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end fade-up">
              <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-elevated px-4 py-2.5 text-[14px] leading-relaxed text-foreground border border-border">
                {m.text}
              </div>
            </div>
          )
        )}

        {/* Chips */}
        <div className="flex flex-wrap gap-2 pt-1 fade-up">
          {chips.map((c) => (
            <button
              key={c}
              className="px-3.5 py-2 text-[12.5px] rounded-xl border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 pt-3 pb-2 bg-background">
        <div className="flex items-center gap-2 rounded-2xl bg-card border border-border pl-4 pr-2 py-2">
          <input
            placeholder="Murabbiyga yozing..."
            className="flex-1 bg-transparent outline-none text-[14px] text-foreground placeholder:text-tertiary"
          />
          <button className="p-2 text-muted-foreground hover:text-foreground transition">
            <Send size={18} />
          </button>
          <button className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95">
            <Mic size={16} />
          </button>
        </div>
        <p className="text-center text-[10px] text-tertiary mt-1.5">
          Ovozli xabar uchun bosib turing
        </p>
      </div>
    </div>
  );
}
