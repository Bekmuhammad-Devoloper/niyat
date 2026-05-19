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
      <div className="grid grid-cols-5 px-2 pt-2 pb-6">
        {tabs.map(({ key, label, Icon, center }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="flex flex-col items-center justify-center gap-1 py-1 transition-transform active:scale-95"
            >
              <div className="relative flex items-center justify-center">
                {isActive && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
                <Icon
                  size={center ? 26 : 22}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  className={
                    center
                      ? "text-primary"
                      : isActive
                      ? "text-foreground"
                      : "text-tertiary"
                  }
                />
              </div>
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "text-foreground" : "text-tertiary"
                } ${center ? "text-primary" : ""}`}
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
