// Niyat ovozli muloqot rejimi — to'liq ekran tap-to-talk tajriba.
//
// Foydalanuvchi tugmani bossa shu modal ochiladi:
//   1. AI iltifot bilan salomlashadi (TTS)
//   2. Foydalanuvchi katta mikrofon tugmasini bosib gapiradi
//   3. Qaytadan bosadi → audio Whisper'ga jo'natiladi → AI javob beradi (TTS)
//   4. Buyruqlar avtomatik bajariladi (ilova ochish, qo'ng'iroq, alarm...)
// X bilan yopiladi.

import { useEffect } from "react";
import { X, Mic, MicOff, Square, Loader2 } from "lucide-react";
import { useNiyatVoice } from "@/lib/hooks/use-niyat-voice";

export function NiyatVoiceMode({ open, onClose }: { open: boolean; onClose: () => void }) {
  const v = useNiyatVoice({ active: open });

  // Escape — yopish
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const stateLabel = (() => {
    if (v.error) return "Xato";
    switch (v.state) {
      case "recording":
        return "Yozyapman...";
      case "processing":
        return "O'ylayapman...";
      case "speaking":
        return "Gapiryapman";
      case "error":
        return "Xato yuz berdi";
      default:
        return "Mikrofonni bosing va gapiring";
    }
  })();

  const canPressMic =
    v.state === "idle" || v.state === "recording" || v.state === "error";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a1f1c 0%, #0a0d0b 60%, #060807 100%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-tertiary">
            Niyat — ovozli
          </p>
          <p className="text-[14px] font-semibold text-foreground mt-0.5">
            {stateLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="h-10 w-10 rounded-full bg-elevated/60 border border-border flex items-center justify-center active:scale-95 transition"
        >
          <X size={18} className="text-foreground" />
        </button>
      </div>

      {/* Asosiy maydon */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <VoiceOrb state={v.state} />

        {/* AI javobi */}
        {v.aiResponse && (
          <p className="mt-10 text-center text-[15px] text-foreground leading-relaxed max-w-[300px] line-clamp-6">
            {v.aiResponse}
          </p>
        )}

        {/* Foydalanuvchi transkripti */}
        {v.userTranscript && (
          <p className="mt-4 text-center text-[13px] text-primary italic max-w-[300px]">
            “{v.userTranscript}”
          </p>
        )}

        {v.error && (
          <p className="mt-6 text-center text-[12px] text-destructive max-w-[320px] leading-relaxed">
            {v.error}
          </p>
        )}
      </div>

      {/* Pastdagi yozish tugmasi */}
      <div className="pb-10 px-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void v.toggleRecording()}
          disabled={!canPressMic}
          aria-label={v.isRecording ? "Yozishni to'xtatish" : "Yozishni boshlash"}
          className={`h-20 w-20 rounded-full flex items-center justify-center transition-all ${
            v.isRecording
              ? "bg-destructive text-destructive-foreground shadow-2xl shadow-destructive/40 scale-110"
              : v.state === "processing" || v.state === "speaking"
                ? "bg-elevated/40 text-tertiary"
                : "bg-primary text-primary-foreground shadow-xl shadow-primary/40 active:scale-95"
          }`}
        >
          {v.isRecording ? (
            <Square size={28} fill="currentColor" />
          ) : v.state === "processing" ? (
            <Loader2 size={32} className="animate-spin" />
          ) : v.state === "speaking" ? (
            <MicOff size={32} />
          ) : (
            <Mic size={32} />
          )}
        </button>
        <p className="text-[11px] text-tertiary text-center max-w-[280px]">
          {v.isRecording
            ? "Yozyapman... gapirib bo'lganingizda yana bosing"
            : v.state === "processing"
              ? "Whisper transkripsiya qilyapti..."
              : v.state === "speaking"
                ? "Murabbiy javob beryapti"
                : "Mikrofonni bosing va gapiring"}
        </p>
      </div>
    </div>
  );
}

function VoiceOrb({
  state,
}: {
  state: ReturnType<typeof useNiyatVoice>["state"];
}) {
  const colors: Record<typeof state, [string, string]> = {
    idle: ["#3a3a30", "#1a1a14"],
    recording: ["#f0c853", "#9a7a30"],
    processing: ["#7ea2ff", "#3a4a8a"],
    speaking: ["#7fdeb0", "#2a6a55"],
    error: ["#c85450", "#5a2a28"],
  };
  const [outer, inner] = colors[state] ?? colors.idle;

  const pulseClass =
    state === "processing"
      ? "niyat-orb-pulse-fast"
      : state === "speaking"
        ? "niyat-orb-pulse-slow"
        : state === "recording"
          ? "niyat-orb-pulse-strong"
          : "";

  return (
    <div className="relative h-[180px] w-[180px]">
      <div
        className="absolute inset-0 rounded-full opacity-20"
        style={{
          background: `radial-gradient(circle, ${outer} 0%, transparent 70%)`,
          animation:
            state === "recording" || state === "speaking"
              ? "niyat-orb-ripple 2.5s ease-out infinite"
              : "none",
        }}
      />
      <div
        className={`absolute inset-8 rounded-full ${pulseClass}`}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${outer} 0%, ${inner} 60%, #000 100%)`,
          boxShadow: `0 0 40px ${outer}55, inset 0 0 30px rgba(255,255,255,0.08)`,
          transition: "background 600ms ease",
        }}
      />
      <div
        className="absolute inset-14 rounded-full"
        style={{
          background: `radial-gradient(circle, ${outer} 0%, transparent 60%)`,
          opacity: 0.5,
          filter: "blur(10px)",
        }}
      />
    </div>
  );
}
