import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  History,
  Mic,
  MicOff,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  type CoachMessage,
  coachSuggestionChips,
  initialCoachMessages,
  profile,
} from "@/lib/niyat-data";
import { useLocalState } from "@/lib/use-local-state";
import { useUserProfile, isPremiumActive } from "@/lib/hooks/use-user-profile";
import { useCoach } from "@/lib/hooks/use-coach";
import { useCoachSessions, type ChatSession } from "@/lib/hooks/use-coach-sessions";
import { useSettings } from "@/lib/hooks/use-settings";
import { useWhisperStt } from "@/lib/hooks/use-whisper-stt";
import { sendMicHeartbeat } from "@/lib/hooks/use-background-mic";
import { useMicCoordinator } from "../MicCoordinator";
import { useCoachTTS } from "@/lib/hooks/use-coach-tts";
import { useNiyats } from "@/lib/hooks/use-niyats";
import { autoCapitalize } from "@/lib/text-utils";
import { NiyatLogo } from "../Logo";
import { BottomSheet } from "../BottomSheet";

function GeoAvatar({ size = 36 }: { size?: number }) {
  return <NiyatLogo size={size} rounded={Math.round(size / 3.3)} />;
}

export function CoachScreen() {
  const {
    sessions,
    activeId,
    messages,
    setActiveMessages: setMessages,
    newSession,
    switchSession,
    deleteSession,
    resetActive,
  } = useCoachSessions();
  const [messageCount, setMessageCount] = useLocalState<number>("niyat:stats:messageCount", 0);
  const niyats = useNiyats();
  const { profile: user } = useUserProfile();
  const { settings } = useSettings();
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const coach = useCoach();
  const tts = useCoachTTS();
  const [usingRealAI, setUsingRealAI] = useState<boolean | null>(null);

  // Mikrofon (Whisper STT). Web Speech API'dan voz kechdik — Android WebView'da
  // ishonchli emas (crbug.com/487255), ko'p qurilmalarda not-allowed xato beradi.
  // Whisper esa /api/stt orqali server tomonda transkripsiya qiladi, MediaRecorder
  // hamma joyda ishlaydi. micActive true bo'lsa ovoz tinglanadi, jim qolsangiz
  // yoziladi va matn input maydoniga qo'shiladi.
  const [micActive, setMicActive] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const { request: requestMic, release: releaseMic } = useMicCoordinator();

  // micActive flip qilinganda BackgroundMic'ni avval to'liq to'xtatib
  // yoki qayta tiklab beramiz. Ruxsat berilmasa, micActive'ni qaytaramiz
  // false'ga — bu kombinatsiya useWhisperStt'ni boshlamaydi va
  // foydalanuvchiga aniq xato xabari ko'rinadi.
  useEffect(() => {
    if (!micActive) {
      releaseMic("coach");
      setMicReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const granted = await requestMic("coach");
      if (cancelled) return;
      if (!granted) {
        toast.error(
          "Mikrofon ruxsati berilmadi. Sozlamalar → Niyat → Ruxsatlar → Mikrofon",
          {
            duration: 6000,
            action: {
              label: "Sozlamalar",
              onClick: async () => {
                const { openMicPermissionSettings } = await import(
                  "@/lib/hooks/use-background-mic"
                );
                await openMicPermissionSettings();
              },
            },
          },
        );
        setMicActive(false);
        return;
      }
      setMicReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [micActive, requestMic, releaseMic]);

  // Sozlamadagi micAlwaysOn — boshlang'ich qiymat sifatida
  useEffect(() => {
    if (settings.voice.micAlwaysOn) setMicActive(true);
  }, [settings.voice.micAlwaysOn]);

  const stt = useWhisperStt({
    active:
      micActive
      && micReady
      && !tts.isPlaying
      && !tts.isLoading
      && !coach.isPending,
    onTranscript: (text) => {
      setDraft((prev) => {
        const next = prev ? `${prev} ${text}` : text;
        return autoCapitalize(next);
      });
      void sendMicHeartbeat(text);
    },
    onError: (msg) => {
      console.warn("[coach-mic]", msg);
      toast.error(msg);
    },
  });
  const isListening = stt.state === "listening" || stt.state === "recording";

  const isCoachTyping = coach.isPending && !streamingText;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, isCoachTyping, streamingText]);

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || coach.isPending) return;
    const userMessage: CoachMessage = {
      id: `u-${Date.now()}`,
      from: "user",
      text,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setMessageCount(messageCount + 1);
    setDraft("");
    setStreamingText("");

    try {
      const result = await coach.send({
        history: messages,
        userText: text,
        userContext: {
          firstName: user.firstName,
          // Faol (bajarilmagan) niyatlar AI'ga uzatiladi — kontekst uchun
          niyat: niyats.undoneTexts.join(" | ") || undefined,
        },
        personality: settings.aiPersonality,
        onDelta: (partial) => setStreamingText(partial),
      });
      const reply: CoachMessage = {
        id: `c-${Date.now()}`,
        from: "coach",
        text: result.reply,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
      setStreamingText(null);
      if (usingRealAI === null) {
        setUsingRealAI(result.usingRealAI);
        if (!result.usingRealAI) {
          toast.info("Demo rejim: AI API kaliti sozlanmagan.", { duration: 5000 });
        }
      }
      // TTS yoqilgan bo'lsa, javobni eshittiramiz (faqat Premium)
      if (isPremiumActive(user) && settings.voice.ttsEnabled) {
        tts.speak(result.reply).catch(() => undefined);
      }
    } catch (err) {
      console.error(err);
      toast.error("Xabar yuborishda xatolik");
      setStreamingText(null);
    }
  };

  const handleChip = (chip: string) => {
    sendMessage(chip);
    inputRef.current?.focus();
  };

  const playMessage = (text: string) => {
    // Premium gate
    if (!isPremiumActive(user)) {
      toast("Ovozli o'qish — Premium funksiyasi", {
        description: "Men → Premium obuna",
        icon: <Sparkles size={16} className="text-primary" />,
        duration: 4000,
      });
      return;
    }
    if (tts.isPlaying) {
      tts.stop();
      return;
    }
    tts.speak(text).catch(() => undefined);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <GeoAvatar size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground leading-tight inline-flex items-center gap-1.5">
            Murabbiy
            {usingRealAI === true && (
              <Sparkles size={11} className="text-primary" aria-label="Real AI" />
            )}
          </p>
          <p className="text-[11px] text-tertiary leading-tight mt-0.5">
            Sizni {profile.coachKnowsForDays} kundan beri taniydi
            {usingRealAI === false && " · demo rejim"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Suhbat tarixi"
          onClick={() => setHistoryOpen(true)}
          className="text-muted-foreground p-1.5 rounded-lg hover:bg-elevated/50 hover:text-foreground transition"
        >
          <History size={18} />
        </button>
        <button
          type="button"
          aria-label="Yangi suhbat"
          onClick={() => {
            newSession();
            setStreamingText(null);
            toast.info("Yangi suhbat boshlandi");
          }}
          className="text-muted-foreground p-1.5 rounded-lg hover:bg-elevated/50 hover:text-foreground transition"
        >
          <Plus size={18} />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-5 py-5 space-y-5">
        {messages.map((m) =>
          m.from === "coach" ? (
            <div key={m.id} className="fade-up group">
              <div className="pl-4 border-l-[3px] border-primary">
                <p className="text-[14.5px] leading-relaxed text-foreground whitespace-pre-line">
                  {m.text}
                </p>
                {/* Eshitish tugmasi faqat Premium foydalanuvchilarga ko'rinadi.
                    OpenAI TTS — odam ovozi kabi tabiiy. */}
                {isPremiumActive(user) && (
                  <button
                    type="button"
                    onClick={() => playMessage(m.text)}
                    disabled={tts.isLoading}
                    aria-label={tts.isPlaying ? "To'xtatish" : "Eshitish"}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-tertiary hover:text-primary disabled:opacity-50 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    {tts.isLoading ? (
                      <Volume2 size={12} className="animate-pulse" />
                    ) : tts.isPlaying ? (
                      <VolumeX size={12} />
                    ) : (
                      <Volume2 size={12} />
                    )}
                    {tts.isLoading
                      ? "Yuklanyapti..."
                      : tts.isPlaying
                        ? "To'xtatish"
                        : "Eshitish"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-end fade-up">
              <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-elevated px-4 py-2.5 text-[14px] leading-relaxed text-foreground border border-border whitespace-pre-line">
                {m.text}
              </div>
            </div>
          ),
        )}

        {/* Streaming preview */}
        {streamingText !== null && (
          <div className="fade-up">
            <div className="pl-4 border-l-[3px] border-primary/60">
              <p className="text-[14.5px] leading-relaxed text-foreground whitespace-pre-line">
                {streamingText}
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/70 align-middle animate-pulse" />
              </p>
            </div>
          </div>
        )}

        {isCoachTyping && (
          <div className="fade-up" aria-live="polite">
            <div className="pl-4 border-l-[3px] border-primary/40 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 pulse-gold" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/50 pulse-gold" style={{ animationDelay: "120ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/30 pulse-gold" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}

        {messages.length <= initialCoachMessages.length && !isCoachTyping && (
          <div className="flex flex-wrap gap-2 pt-1 fade-up">
            {coachSuggestionChips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleChip(c)}
                className="px-3.5 py-2 text-[12.5px] rounded-xl border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(draft);
        }}
        className="border-t border-border px-4 pt-3 pb-2 bg-background"
      >
        <div className="flex items-center gap-2 rounded-2xl bg-card border border-border pl-4 pr-2 py-2">
          <label htmlFor="coach-input" className="sr-only">
            Murabbiyga xabar
          </label>
          <input
            id="coach-input"
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(autoCapitalize(e.target.value))}
            maxLength={500}
            autoCapitalize="sentences"
            placeholder={isListening ? "Tinglayapman..." : "Murabbiyga yozing..."}
            className="flex-1 bg-transparent outline-none text-[14px] text-foreground placeholder:text-tertiary"
          />
          <button
            type="submit"
            disabled={!draft.trim() || coach.isPending}
            aria-label="Xabarni yuborish"
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground transition"
          >
            <Send size={18} />
          </button>
          <button
            type="button"
            aria-label={micActive ? "Mikrofonni to'xtatish" : "Ovozli xabar"}
            onClick={() => {
              if (typeof navigator === "undefined" || !navigator.mediaDevices) {
                toast.info("Brauzeringiz ovozli kiritishni qo'llamaydi");
                return;
              }
              setMicActive((v) => !v);
            }}
            className={`h-9 w-9 rounded-xl flex items-center justify-center active:scale-95 transition ${
              isListening
                ? "bg-destructive/90 text-destructive-foreground pulse-gold"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {micActive ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>
        <p className="text-center text-[10px] mt-1.5">
          {stt.error ? (
            <span className="text-destructive">{stt.error}</span>
          ) : tts.isPlaying ? (
            <span className="text-tertiary">Murabbiy javob beryapti...</span>
          ) : stt.state === "recording" ? (
            <span className="text-primary inline-flex items-center gap-1">
              Yozyapman — jim qoling, avtomatik yuboraman
            </span>
          ) : stt.state === "listening" ? (
            <span className="text-primary">Eshityapman — gapiring</span>
          ) : stt.state === "transcribing" ? (
            <span className="text-tertiary">Matnga aylantiryapman...</span>
          ) : micActive ? (
            <span className="text-tertiary">Mikrofon tayyorlanyapti...</span>
          ) : (
            <span className="text-tertiary">Ovozli xabar uchun mic bosing</span>
          )}
        </p>
      </form>

      <ChatHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={sessions}
        activeId={activeId}
        onSelect={(id) => {
          switchSession(id);
          setStreamingText(null);
          setHistoryOpen(false);
        }}
        onDelete={(id) => {
          deleteSession(id);
          setStreamingText(null);
        }}
        onNew={() => {
          newSession();
          setStreamingText(null);
          setHistoryOpen(false);
        }}
        onResetActive={() => {
          resetActive();
          setStreamingText(null);
          setHistoryOpen(false);
          toast.info("Suhbat boshidan boshlandi");
        }}
      />
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "hozir";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} daq oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} kun oldin`;
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ChatHistorySheet({
  open,
  onClose,
  sessions,
  activeId,
  onSelect,
  onDelete,
  onNew,
  onResetActive,
}: {
  open: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onResetActive: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Suhbat tarixi" fullHeight>
      <div className="space-y-3">
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold active:scale-[0.99] transition"
        >
          <Plus size={16} />
          Yangi suhbat
        </button>

        {sessions.length === 0 ? (
          <p className="text-center text-[13px] text-tertiary font-serif italic py-8">
            Tarix bo'sh
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              const userCount = s.messages.filter((m) => m.from === "user").length;
              return (
                <li key={s.id}>
                  <div
                    className={`flex items-stretch gap-1 rounded-xl border transition ${
                      isActive
                        ? "bg-primary/10 border-primary/40"
                        : "bg-card border-border hover:bg-elevated/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className="flex-1 min-w-0 text-left px-3 py-2.5"
                    >
                      <p
                        className={`text-[13px] leading-snug truncate ${
                          isActive ? "text-primary font-semibold" : "text-foreground"
                        }`}
                      >
                        {s.title}
                      </p>
                      <p className="text-[10px] text-tertiary mt-0.5 tabular">
                        {userCount} xabar · {formatRelative(s.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label="Suhbatni o'chirish"
                      onClick={() => {
                        if (confirm(`"${s.title}" suhbatini o'chirasizmi?`)) {
                          onDelete(s.id);
                        }
                      }}
                      className="px-3 text-tertiary hover:text-destructive transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {sessions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Joriy suhbatni qaytadan boshlaymizmi?")) {
                onResetActive();
              }
            }}
            className="w-full text-center text-[12px] text-tertiary hover:text-destructive transition py-3"
          >
            Joriy suhbatni boshidan boshlash
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
