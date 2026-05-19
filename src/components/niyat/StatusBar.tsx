import { Signal, Wifi, BatteryFull } from "lucide-react";

export function StatusBar() {
  return (
    <div className="flex items-center justify-between px-8 pt-3 pb-1 text-[12px] text-foreground tabular font-medium">
      <span>9:41</span>
      <div className="flex items-center gap-1 opacity-80">
        <Signal size={14} />
        <Wifi size={14} />
        <BatteryFull size={16} />
      </div>
    </div>
  );
}
