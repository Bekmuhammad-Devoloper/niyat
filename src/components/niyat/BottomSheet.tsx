import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Telefon ramkasi ichida ishlovchi yengil bottom-sheet — Radix Dialog'ga
// muqobil. Phone-frame ichida absolutely positioned.
// Backdrop bosilsa yopiladi, ESC ham yopadi, ichidagi scroll mustaqil.

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  fullHeight = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm fade-up"
        style={{ animationDuration: "200ms" }}
      />
      {/* Sheet */}
      <div
        ref={dialogRef}
        className={`relative bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col ${
          fullHeight ? "h-[92%]" : "max-h-[85%]"
        }`}
        style={{ animation: "slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="flex items-center justify-center pt-3">
          <span className="h-1 w-12 rounded-full bg-tertiary/40" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="font-serif text-[20px] text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="p-1.5 rounded-lg text-tertiary hover:bg-elevated/50 hover:text-foreground transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
