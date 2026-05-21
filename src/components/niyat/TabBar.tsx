import { Home, Target, MessageCircle, Moon, User } from "lucide-react";
import { TabKey } from "./types";

const tabs: { key: TabKey; label: string; Icon: typeof Home; center?: boolean }[] = [
  { key: "home", label: "Bosh sahifa", Icon: Home },
  { key: "goals", label: "Maqsadlar", Icon: Target },
  { key: "coach", label: "Murabbiy", Icon: MessageCircle, center: true },
  { key: "worship", label: "Ibodat", Icon: Moon },
  { key: "me", label: "Men", Icon: User },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <nav className="relative border-t border-border bg-background/95 backdrop-blur-sm">
      <div className="grid grid-cols-5 px-2 pt-2 pb-6 items-end">
        {tabs.map(({ key, label, Icon, center }) => {
          const isActive = active === key;
          if (center) {
            return (
              <button
                key={key}
                onClick={() => onChange(key)}
                className="flex flex-col items-center gap-1 -mt-6 active:scale-95 transition"
              >
                <span
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 ${
                    isActive ? "bg-primary" : "bg-primary/90"
                  }`}
                >
                  <Icon size={22} strokeWidth={2} className="text-primary-foreground" />
                </span>
                <span className="text-[10px] leading-none text-primary font-medium">
                  {label}
                </span>
              </button>
            );
          }
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="flex flex-col items-center justify-center gap-1.5 py-1 transition-transform active:scale-95"
            >
              <div className="relative flex items-center justify-center">
                {isActive && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  className={isActive ? "text-foreground" : "text-tertiary"}
                />
              </div>
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "text-foreground" : "text-tertiary"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
