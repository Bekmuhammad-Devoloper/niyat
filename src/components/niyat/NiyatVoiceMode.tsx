// Niyat ovozli muloqot rejimi — Siri/ChatGPT voice kabi to'liq ekran tajriba.
//
// Foydalanuvchi tugmani bossa shu modal ochiladi:
//   1. AI iltifot bilan salomlashadi (TTS)
//   2. Mikrofon yoqiladi, foydalanuvchi gapiradi
//   3. Pauza qilganda matn AI'ga yuboriladi
//   4. AI ovozli javob beradi (TTS) — ichida telefon buyruqlari bo'lishi mumkin
//   5. Buyruqlar avtomatik bajariladi (ilova ochish, qo'ng'iroq, alarm...)
//   6. Yana mikrofon yoqiladi — hands-free
// Pastdagi X bilan yopiladi.

import { useEffect } from "react";
import { X, Mic, MicOff } from "lucide-react";
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
    if (v.error) return "Xato — qayta urinib ko'ring";
    switch (v.state) {
      case "listening":
        return "Eshityapman...";
      case "recording":
        return "Yozyapman...";
      case "processing":
        return "O'ylayapman...";
      case "speaking":
        return "Gapiryapman";
      case "error":
        return "Xato yuz berdi";
      default:
        return "Tayyorlanyapman...";
    }
  })();

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

      {/* Orb — animatsiyali */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <VoiceOrb state={v.state} level={v.audioLevel} />

        {/* AI javobi */}
        {v.aiResponse && (
          <p className="mt-10 text-center text-[15px] text-foreground leading-relaxed max-w-[300px] line-clamp-6">
            {v.aiResponse}
          </p>
        )}

        {/* Foydalanuvchi transkripti (so'nggi) */}
        {v.userTranscript && (
          <p className="mt-4 text-center text-[13px] text-primary italic max-w-[300px]">
            “{v.userTranscript}”
          </p>
        )}

        {v.error && (
          <p className="mt-6 text-center text-[12px] text-destructive">
            {v.error}
          </p>
        )}

        {!v.sttSupported && (
          <p className="mt-6 text-center text-[12px] text-amber-400/90 leading-relaxed">
            Bu brauzer mikrofonni qo'llab-quvvatlamaydi. APK telefon ilovasidan
            foydalaning.
          </p>
        )}
      </div>

      {/* Bottom — yordamchi */}
      <div className="px-6 pb-8 flex items-center justify-center gap-2 text-[11px] text-tertiary">
        {v.state === "recording" ? (
          <>
            <Mic size={12} className="text-primary animate-pulse" />
            <span>Yozyapman — gapirib bo'lganingizda jim turing</span>
          </>
        ) : v.state === "listening" ? (
          <>
            <Mic size={12} className="text-primary" />
            <span>Eshityapman · gapiring</span>
          </>
        ) : v.state === "processing" ? (
          <>
            <Mic size={12} />
            <span>Whisper transkripsiya qilyapti...</span>
          </>
        ) : v.state === "speaking" ? (
          <>
            <MicOff size={12} />
            <span>Mikrofon vaqtincha jim</span>
          </>
        ) : (
          <>
            <MicOff size={12} />
            <span>Tayyorlanyapman</span>
          </>
        )}
      </div>
    </div>
  );
}

function VoiceOrb({
  state,
  level = 0,
}: {
  state: ReturnType<typeof useNiyatVoice>["state"];
  level?: number;
}) {
  const colors = {
    idle: ["#3a3a30", "#1a1a14"],
    listening: ["#D4B86A", "#8a7340"],
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
        : state === "listening"
          ? "niyat-orb-pulse-strong"
          : "";

  // Recording paytida audio level'iga qarab orbni shishirib turamiz
  const scale =
    state === "recording" ? 1 + Math.min(0.35, level * 12) : 1;

  return (
    <div className="relative h-[200px] w-[200px]">
      {/* Tashqi halqalar — ripple effekt */}
      <div
        className="absolute inset-0 rounded-full opacity-20"
        style={{
          background: `radial-gradient(circle, ${outer} 0%, transparent 70%)`,
          animation:
            state === "listening" || state === "speaking"
              ? "niyat-orb-ripple 2.5s ease-out infinite"
              : "none",
        }}
      />
      <div
        className="absolute inset-4 rounded-full opacity-30"
        style={{
          background: `radial-gradient(circle, ${outer} 0%, transparent 65%)`,
          animation:
            state === "listening" || state === "speaking"
              ? "niyat-orb-ripple 2.5s ease-out infinite 0.5s"
              : "none",
        }}
      />
      {/* Asosiy orb */}
      <div
        className={`absolute inset-10 rounded-full ${pulseClass}`}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${outer} 0%, ${inner} 60%, #000 100%)`,
          boxShadow: `0 0 40px ${outer}55, inset 0 0 30px rgba(255,255,255,0.08)`,
          transform: `scale(${scale})`,
          transition: "background 600ms ease, box-shadow 600ms ease, transform 100ms ease-out",
        }}
      />
      {/* Ichki yorug'lik */}
      <div
        className="absolute inset-16 rounded-full"
        style={{
          background: `radial-gradient(circle, ${outer} 0%, transparent 60%)`,
          opacity: 0.5,
          filter: "blur(10px)",
        }}
      />
    </div>
  );
}
