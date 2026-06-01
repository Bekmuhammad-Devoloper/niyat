import { AlertCircle, Megaphone, X } from "lucide-react";
import { useAnnouncementsPublic } from "@/lib/hooks/use-announcements";

// Bosh sahifa tepasida ko'rinadigan e'lon banner.
// Faqat o'qilmagan e'lonlardan eng yangisi ko'rsatiladi.
// Foydalanuvchi X bossa "o'qildi" deb belgilanadi va boshqa ko'rinmaydi.
export function AnnouncementBanner() {
  const { unread, markRead } = useAnnouncementsPublic();
  if (unread.length === 0) return null;

  const a = unread[0]; // eng yangi o'qilmagan

  const isCritical = a.priority === "critical";
  const isImportant = a.priority === "important";

  return (
    <div
      className={`mx-6 mt-3 rounded-2xl border p-4 fade-up ${
        isCritical
          ? "bg-destructive/10 border-destructive/40"
          : isImportant
            ? "bg-primary/10 border-primary/40"
            : "bg-card border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {isCritical ? (
            <AlertCircle size={16} className="text-destructive" />
          ) : (
            <Megaphone size={16} className={isImportant ? "text-primary" : "text-tertiary"} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">{a.title}</p>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
            {a.body}
          </p>
          {unread.length > 1 && (
            <p className="text-[10px] text-tertiary mt-2">
              + yana {unread.length - 1} ta yangi e'lon
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => markRead(a.id)}
          aria-label="Yopish"
          className="text-tertiary hover:text-foreground transition shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
