import { useEffect, useRef, useState } from "react";
import {
  Compass,
  MapPin,
  Navigation,
  AlertTriangle,
  Play,
  ExternalLink,
} from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useSettings } from "@/lib/hooks/use-settings";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import {
  distanceToKaabaKm,
  qiblaBearing,
  KAABA_LATITUDE,
  KAABA_LONGITUDE,
} from "@/lib/data/namoz-guide";

// Asosiy video — 21X5lGlDOfg (Makkah Live, IQRA TV). Bu video YouTube'da
// yillar davomida 24/7 ishlamoqda, thumbnail'i kafolatlangan ravishda
// img.youtube.com'dan yuklanadi.
const MAIN_VIDEO_ID = "21X5lGlDOfg";
const MAIN_THUMB = `https://img.youtube.com/vi/${MAIN_VIDEO_ID}/maxresdefault.jpg`;
const MAIN_THUMB_FALLBACK = `https://img.youtube.com/vi/${MAIN_VIDEO_ID}/hqdefault.jpg`;
const MAIN_URL = `https://www.youtube.com/watch?v=${MAIN_VIDEO_ID}`;

// Qo'shimcha kanallar — kichik link qatorlari, rasmga muhtoj emas
const EXTRA_CHANNELS = [
  {
    id: "madinah",
    title: "Madinah Live",
    desc: "Masjid an-Nabawi jonli efiri",
    url: "https://www.youtube.com/results?search_query=madinah+live+now&sp=EgJAAQ%253D%253D",
    arabic: "ٱلْمَدِينَة",
  },
  {
    id: "quran-tv",
    title: "Saudi Qur'on TV",
    desc: "Rasmiy davlat kanali — tilovat va xutbalar",
    url: "https://www.youtube.com/@quran/live",
    arabic: "ٱلْقُرْآن",
  },
  {
    id: "search-all",
    title: "Barcha jonli efirlar",
    desc: "YouTube'da \"makkah live\" qidiruvi",
    url: "https://www.youtube.com/results?search_query=makkah+madinah+live&sp=EgJAAQ%253D%253D",
    arabic: "ٱلْحَرَمَيْن",
  },
];

export function KaabaSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const { request, status: geoStatus } = useGeolocation();
  const location = settings.location;
  const [heading, setHeading] = useState<number | null>(null);
  const [orientationStatus, setOrientationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unsupported" | "no-data"
  >("idle");
  // Heading'ni smooth qilish uchun EMA buffer
  const headingEmaRef = useRef<number | null>(null);
  // True/absolute orientation aniqlanganmi? (aniqroq kompas)
  const [isAbsolute, setIsAbsolute] = useState(false);
  // Manual mode — desktop yoki sensorsiz qurilmalar uchun foydalanuvchi
  // kompasni qo'lda buradi (drag)
  const [manualHeading, setManualHeading] = useState<number>(0);
  const [isManualMode, setIsManualMode] = useState(false);
  const compassRef = useRef<HTMLDivElement>(null);
  // maxresdefault ba'zi videolarda yo'q — onError'da hqdefault'ga o'tamiz
  const [thumbSrc, setThumbSrc] = useState(MAIN_THUMB);
  const [thumbFailed, setThumbFailed] = useState(false);

  // Heading qiymatini smooth qilish (jitter'ni kamaytirish uchun EMA).
  // Smoothing factor: 0.2 — past, 0.5 — o'rtacha, 0.85 — agressiv.
  const updateHeading = (raw: number) => {
    // Burchak farqi 180°dan kichik bo'lishi uchun normalize qilamiz
    // (masalan 359° -> 1° o'tishini to'g'ri ushlash uchun)
    const prev = headingEmaRef.current;
    let next: number;
    if (prev == null) {
      next = raw;
    } else {
      let diff = raw - prev;
      if (diff > 180) diff -= 360;
      else if (diff < -180) diff += 360;
      // EMA: yangi qiymat = oldingi + alpha * farq
      next = (prev + diff * 0.25 + 360) % 360;
    }
    headingEmaRef.current = next;
    setHeading(next);
  };

  // Ekran burilishi (screen orientation) — heading'ga qo'shamiz
  const getScreenAngle = (): number => {
    if (typeof window === "undefined") return 0;
    const so = window.screen?.orientation;
    if (so && typeof so.angle === "number") return so.angle;
    // Eski iOS — window.orientation
    const legacy = (window as unknown as { orientation?: number }).orientation;
    return typeof legacy === "number" ? legacy : 0;
  };

  // Universal handler — barcha platformalar uchun
  const orientationHandler = (e: DeviceOrientationEvent) => {
    // iOS — webkitCompassHeading true north'ga nisbatan (eng aniq)
    const webkitHeading = (e as DeviceOrientationEvent & {
      webkitCompassHeading?: number;
    }).webkitCompassHeading;
    if (typeof webkitHeading === "number") {
      updateHeading(webkitHeading);
      setIsAbsolute(true);
      return;
    }
    // Android (absolute = true) — magnit shimol
    if (typeof e.alpha === "number") {
      // Alpha: device-Z aylanish, soat strelkasi teskari. Heading uchun
      // (360 - alpha) + screen angle compensation.
      const screenAngle = getScreenAngle();
      const computed = (360 - e.alpha + screenAngle + 360) % 360;
      updateHeading(computed);
      // `absolute` true bo'lsa magnit shimolga moslashgan
      const absolute = (e as DeviceOrientationEvent & { absolute?: boolean }).absolute;
      setIsAbsolute(absolute === true);
    }
  };

  // DeviceOrientationEvent — kompas. Sheet ochilganda boshlanadi.
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setOrientationStatus("unsupported");
      return;
    }

    // iOS 13+ permissionga muhtoj
    type IOSDOEvent = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const requestPermission = (DeviceOrientationEvent as IOSDOEvent)
      .requestPermission;

    if (typeof requestPermission === "function") {
      // iOS — foydalanuvchi tugma bosishi kerak
      setOrientationStatus("idle");
      return;
    }

    // Android va boshqalar — to'g'ridan-to'g'ri ulashamiz.
    let receivedEvent = false;
    const wrappedHandler = (e: DeviceOrientationEvent) => {
      receivedEvent = true;
      orientationHandler(e);
    };

    // `deviceorientationabsolute` — Chrome Android'da (true compass)
    window.addEventListener(
      "deviceorientationabsolute" as "deviceorientation",
      wrappedHandler,
      true,
    );
    // `deviceorientation` — fallback (iOS Safari va boshqalar)
    window.addEventListener("deviceorientation", wrappedHandler, true);
    setOrientationStatus("granted");

    // 3 sekund'da event kelmagan bo'lsa — kompas sensori yo'q (masalan
    // desktop yoki sensorsiz emulyator). Manual mode'ga o'tamiz.
    const noDataTimeout = window.setTimeout(() => {
      if (!receivedEvent) {
        setOrientationStatus("no-data");
      }
    }, 3000);

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute" as "deviceorientation",
        wrappedHandler,
        true,
      );
      window.removeEventListener("deviceorientation", wrappedHandler, true);
      window.clearTimeout(noDataTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Manual drag/click — kompasni qo'lda burish (desktop yoki sensorsiz qurilma)
  const handleCompassPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isManualMode) return;
    const el = compassRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    // atan2 — kompas burchak: 0 = N (yuqori), soat strelkasi
    const rad = Math.atan2(dx, -dy);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    setManualHeading(deg);
  };

  // Effective heading — sensor yoki manual
  const effectiveHeading = isManualMode ? manualHeading : heading;

  // iOS 13+ permission so'rovi
  const requestOrientation = async () => {
    type IOSDOEvent = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const reqPerm = (DeviceOrientationEvent as IOSDOEvent).requestPermission;
    if (typeof reqPerm !== "function") return;
    setOrientationStatus("requesting");
    try {
      const result = await reqPerm();
      if (result === "granted") {
        setOrientationStatus("granted");
        window.addEventListener(
          "deviceorientationabsolute" as "deviceorientation",
          orientationHandler,
          true,
        );
        window.addEventListener("deviceorientation", orientationHandler, true);
      } else {
        setOrientationStatus("denied");
      }
    } catch {
      setOrientationStatus("denied");
    }
  };

  const bearing = location ? qiblaBearing(location.latitude, location.longitude) : null;
  const distance = location ? distanceToKaabaKm(location.latitude, location.longitude) : null;

  return (
    <BottomSheet open={open} onClose={onClose} title="Ka'ba" fullHeight>
      <div className="space-y-5">
        {/* Hero — Ka'ba ramzi */}
        <div
          className="rounded-2xl p-5 text-center relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,184,106,0.12), rgba(184,166,107,0.04))",
            border: "1px solid rgba(184,166,107,0.22)",
          }}
        >
          <p
            className="font-arabic text-quran text-[28px] text-primary"
            dir="rtl"
          >
            ٱلْكَعْبَةُ ٱلْمُشَرَّفَةُ
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
            Makkai Mukarrama, Saudiya Arabistoni
          </p>
          {distance != null && (
            <p className="mt-3 text-[20px] font-serif tabular text-foreground">
              {distance.toLocaleString("uz-UZ", { maximumFractionDigits: 0 })} km
            </p>
          )}
          {distance != null && (
            <p className="text-[11px] text-tertiary mt-0.5">sizdan masofa</p>
          )}
        </div>

        {/* Jonli efir */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-foreground">
              Makkah jonli efir
            </h3>
            <span className="text-[10px] text-tertiary">YouTube'da ochiladi</span>
          </div>

          {/* Asosiy katta video — HAQIQIY YouTube thumbnail */}
          <a
            href={MAIN_URL}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl overflow-hidden border border-border bg-card active:scale-[0.99] transition hover:border-primary/40 group"
          >
            <div className="relative aspect-video bg-black overflow-hidden">
              {!thumbFailed ? (
                <img
                  key={thumbSrc}
                  src={thumbSrc}
                  alt="Makkah Live — Masjid al-Haram"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    // maxresdefault yo'q bo'lsa hqdefault'ga o'tamiz
                    if (thumbSrc === MAIN_THUMB) {
                      setThumbSrc(MAIN_THUMB_FALLBACK);
                    } else {
                      setThumbFailed(true);
                    }
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, #1a1208 0%, #3a2a18 50%, #2a1f15 100%)",
                  }}
                >
                  <p
                    className="font-arabic text-quran text-[64px] font-bold"
                    dir="rtl"
                    style={{ color: "rgba(212, 184, 106, 0.45)" }}
                  >
                    ٱلْكَعْبَة
                  </p>
                </div>
              )}
              {/* Pastki gradient — title o'qish uchun */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
              {/* Play tugmasi */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-red-600/95 shadow-lg flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform">
                  <Play size={26} className="text-white ml-1" fill="currentColor" />
                </div>
              </div>
              {/* LIVE badge */}
              <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
              {/* External icon */}
              <div className="absolute bottom-2 right-2 h-7 w-7 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <ExternalLink size={12} className="text-white" />
              </div>
            </div>
            <div className="p-3">
              <p className="text-[14px] font-semibold text-foreground leading-tight">
                Makkah Live — Masjid al-Haram
              </p>
              <p className="text-[11px] text-tertiary mt-1 leading-relaxed">
                Ka'baga tavof, 24/7 jonli efir
              </p>
            </div>
          </a>

          {/* Qo'shimcha kanallar — kichik link qatorlari (rasm yo'q) */}
          <p className="mt-4 mb-2 text-[10px] uppercase tracking-wider text-tertiary">
            Boshqa kanallar
          </p>
          <div className="space-y-2">
            {EXTRA_CHANNELS.map((ch) => (
              <a
                key={ch.id}
                href={ch.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl bg-card border border-border p-3 active:scale-[0.99] transition hover:border-primary/40 group"
              >
                {/* Arabic icon block */}
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <p
                    className="font-arabic text-quran text-[14px] text-primary leading-none"
                    dir="rtl"
                  >
                    {ch.arabic}
                  </p>
                </div>
                {/* Title + desc */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">
                      {ch.title}
                    </p>
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600/15 text-red-500 text-[8px] font-bold uppercase tracking-wider">
                      <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </div>
                  </div>
                  <p className="text-[11px] text-tertiary mt-0.5 leading-snug">
                    {ch.desc}
                  </p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-tertiary shrink-0 group-hover:text-primary transition"
                />
              </a>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-tertiary leading-relaxed">
            YouTube ilovasida ochiladi (mobil) yoki yangi tabda (kompyuter).
          </p>
        </section>

        {/* Qibla kompas */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-foreground">
              Qibla yo'nalishi
            </h3>
            {bearing != null && (
              <span className="text-[11px] tabular text-primary">
                {Math.round(bearing)}°
              </span>
            )}
          </div>

          {!location ? (
            <div className="rounded-2xl bg-card border border-border p-5 text-center">
              <MapPin size={20} className="text-tertiary mx-auto mb-2" />
              <p className="text-[13px] text-foreground">
                Qiblani topish uchun joylashuv kerak
              </p>
              <p className="text-[11px] text-tertiary mt-1 leading-relaxed">
                Aniq yo'nalish — sizning shahar koordinatalaringizdan hisoblanadi.
              </p>
              <button
                type="button"
                onClick={() => void request()}
                disabled={geoStatus === "requesting"}
                className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50"
              >
                <Navigation size={13} />
                {geoStatus === "requesting" ? "So'ralyapti..." : "Joylashuvni berish"}
              </button>
            </div>
          ) : (
            (() => {
              // Qiblaga nisbatan farq — manfiy = chap, musbat = o'ng
              const headingActive = effectiveHeading != null;
              let deltaDeg: number | null = null;
              if (headingActive && bearing != null) {
                let d = bearing - effectiveHeading!;
                if (d > 180) d -= 360;
                else if (d < -180) d += 360;
                deltaDeg = d;
              }
              const isAligned = deltaDeg != null && Math.abs(deltaDeg) <= 5;
              const directionLabel = !headingActive
                ? null
                : deltaDeg == null
                  ? null
                  : isAligned
                    ? "Qiblaga to'g'rilangan ✓"
                    : deltaDeg > 0
                      ? `${Math.round(Math.abs(deltaDeg))}° o'ngga buring →`
                      : `← ${Math.round(Math.abs(deltaDeg))}° chapga buring`;

              const accentColor = isAligned
                ? "text-emerald-400"
                : "text-primary";
              const accentBg = isAligned ? "bg-emerald-400" : "bg-primary";

              return (
                <div className="rounded-2xl bg-card border border-border p-5">
                  {/* Yo'nalish hinti */}
                  <div className="text-center mb-3 min-h-[20px]">
                    {directionLabel ? (
                      <p
                        className={`text-[14px] font-semibold tabular transition-colors ${accentColor}`}
                      >
                        {directionLabel}
                      </p>
                    ) : (
                      <p className="text-[12px] text-tertiary">
                        Telefonni gorizontal ushlang va aylantiring
                      </p>
                    )}
                  </div>

                  {/* Kompas */}
                  <div
                    ref={compassRef}
                    onPointerDown={(e) => {
                      if (isManualMode) {
                        (e.currentTarget as HTMLDivElement).setPointerCapture(
                          e.pointerId,
                        );
                        handleCompassPointer(e);
                      }
                    }}
                    onPointerMove={handleCompassPointer}
                    onPointerUp={(e) => {
                      if (isManualMode) {
                        (e.currentTarget as HTMLDivElement).releasePointerCapture(
                          e.pointerId,
                        );
                      }
                    }}
                    className={`relative mx-auto h-56 w-56 ${
                      isManualMode ? "cursor-grab active:cursor-grabbing touch-none" : ""
                    }`}
                  >
                    {/* Tashqi aylana — kompas qadami chiziqlari bilan */}
                    <div
                      className="absolute inset-0 rounded-full border-2 transition-colors"
                      style={{
                        borderColor: isAligned
                          ? "rgba(52, 211, 153, 0.6)"
                          : isManualMode
                            ? "rgba(212, 184, 106, 0.35)"
                            : "rgba(255,255,255,0.1)",
                        background:
                          "radial-gradient(circle, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.2) 100%)",
                      }}
                    />
                    {/* Aylana — telefon yo'nalishiga qarab aylanadi (kartochka effekti) */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        transform: headingActive
                          ? `rotate(${-effectiveHeading!}deg)`
                          : "rotate(0deg)",
                        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      {/* Tick marks — har 30° */}
                      {Array.from({ length: 12 }).map((_, i) => {
                        const angle = i * 30;
                        const isMajor = i % 3 === 0;
                        return (
                          <div
                            key={i}
                            className="absolute left-1/2 top-1 w-0.5 -translate-x-1/2 origin-bottom"
                            style={{
                              height: isMajor ? "10px" : "5px",
                              background: isMajor
                                ? "rgba(255,255,255,0.4)"
                                : "rgba(255,255,255,0.15)",
                              transform: `translate(-50%, 0) rotate(${angle}deg) translateY(0)`,
                              transformOrigin: "50% 110px",
                            }}
                          />
                        );
                      })}
                      {/* Yo'nalish harflari — N qizil */}
                      <div className="absolute left-1/2 top-3.5 -translate-x-1/2 text-[11px] font-bold text-red-500">
                        N
                      </div>
                      <div className="absolute left-1/2 bottom-3.5 -translate-x-1/2 text-[10px] text-tertiary">
                        S
                      </div>
                      <div className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[10px] text-tertiary">
                        W
                      </div>
                      <div className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[10px] text-tertiary">
                        E
                      </div>
                    </div>

                    {/* Qibla o'qi — bearing'ga qarab o'rnatilgan. Heading aylanasi
                        bilan birgalikda ko'rinish to'g'ri. Lekin o'qni mustaqil
                        aylantiramiz — telefon yo'nalishi va qibla orasidagi
                        farq qancha bo'lsa, shuncha buriladi. */}
                    {bearing != null && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          transform: headingActive
                            ? `rotate(${deltaDeg ?? 0}deg)`
                            : `rotate(${bearing}deg)`,
                          transition:
                            "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative h-44 w-1.5">
                            {/* Yuqori — qibla yo'nalishi */}
                            <div
                              className={`absolute top-0 left-0 right-0 h-1/2 rounded-t-full transition-colors ${accentBg}`}
                            />
                            {/* Pastki — orqa */}
                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-tertiary/40 rounded-b-full" />
                            {/* Ka'ba belgisi — arabcha "الكعبة" yozuvi.
                                Qiblaga to'g'rilanganda yashilga aylanadi
                                va porlaydi. Sodda, nafis va o'qib bo'ladigan. */}
                            <div
                              className={`absolute -top-6 left-1/2 -translate-x-1/2 transition-all duration-300 ${
                                isAligned ? "scale-110" : "scale-100"
                              }`}
                              style={{
                                filter: isAligned
                                  ? "drop-shadow(0 0 5px rgba(52,211,153,0.55))"
                                  : "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
                              }}
                              dir="rtl"
                            >
                              <span
                                className={`font-arabic text-quran text-[13px] leading-none font-semibold tracking-tight transition-colors ${
                                  isAligned
                                    ? "text-emerald-400"
                                    : "text-primary"
                                }`}
                              >
                                ٱلْكَعْبَة
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Markaziy nuqta */}
                    <div
                      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-card transition-colors ${accentBg}`}
                    />

                    {/* Yo'nalish indicator — har doim tepa markazda, telefon
                        burnini ko'rsatadi */}
                    <div className="absolute left-1/2 -top-2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-foreground/70" />
                  </div>

                  {/* Qiymatlar */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-elevated/40 p-2">
                      <p className="text-[9px] uppercase tracking-wider text-tertiary">
                        Qibla
                      </p>
                      <p className="text-[14px] font-semibold tabular text-primary mt-0.5">
                        {Math.round(bearing ?? 0)}°
                      </p>
                    </div>
                    <div className="rounded-lg bg-elevated/40 p-2">
                      <p className="text-[9px] uppercase tracking-wider text-tertiary">
                        {isManualMode ? "Qo'lda" : "Telefon"}
                      </p>
                      <p className="text-[14px] font-semibold tabular text-foreground mt-0.5">
                        {headingActive ? `${Math.round(effectiveHeading!)}°` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Manual mode toggle */}
                  {(orientationStatus === "no-data" ||
                    orientationStatus === "denied" ||
                    orientationStatus === "unsupported" ||
                    isManualMode) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isManualMode) {
                          setIsManualMode(false);
                          setManualHeading(0);
                        } else {
                          setIsManualMode(true);
                          setManualHeading(0);
                        }
                      }}
                      className={`mt-3 w-full h-10 rounded-xl text-[12px] font-semibold transition ${
                        isManualMode
                          ? "bg-primary text-primary-foreground"
                          : "bg-elevated text-foreground hover:bg-elevated/70 border border-border"
                      }`}
                    >
                      {isManualMode
                        ? "✓ Qo'lda burish faol — chiqish"
                        : "Qo'lda burish (drag bilan)"}
                    </button>
                  )}

                  {isManualMode && (
                    <p className="mt-2 text-[10px] text-tertiary text-center leading-relaxed">
                      Kompas markazidan tortib aylantiring. Yashil bo'lganda
                      qiblaga to'g'ri qaragansiz.
                    </p>
                  )}

                  {/* Status va calibration hint */}
                  {headingActive && !isAbsolute && !isManualMode && (
                    <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-start gap-2">
                      <AlertTriangle
                        size={13}
                        className="text-amber-500 shrink-0 mt-0.5"
                      />
                      <p className="text-[11px] text-amber-400/90 leading-relaxed">
                        Magnit kompas to'liq aniq emas. Telefonni 8 raqami
                        shaklida bir necha marta aylantirib kalibrlang.
                      </p>
                    </div>
                  )}

                  {orientationStatus === "no-data" && !isManualMode && (
                    <div className="mt-3 rounded-lg bg-elevated p-2.5 flex items-start gap-2">
                      <Compass size={13} className="text-tertiary shrink-0 mt-0.5" />
                      <p className="text-[11px] text-tertiary leading-relaxed">
                        Bu qurilmada kompas sensori topilmadi (yoki desktop
                        rejimda). "Qo'lda burish" tugmasini bosib sinab
                        ko'rishingiz mumkin.
                      </p>
                    </div>
                  )}

                  {orientationStatus === "idle" &&
                    typeof DeviceOrientationEvent !== "undefined" &&
                    "requestPermission" in DeviceOrientationEvent && (
                      <button
                        type="button"
                        onClick={requestOrientation}
                        className="mt-3 w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center gap-2"
                      >
                        <Compass size={14} />
                        Kompasni yoqish
                      </button>
                    )}

                  {orientationStatus === "denied" && (
                    <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
                      <AlertTriangle
                        size={14}
                        className="text-destructive shrink-0 mt-0.5"
                      />
                      <p className="text-[11px] text-destructive">
                        Kompas ruxsati berilmadi. Telefon yuqoridan{" "}
                        <span className="font-semibold tabular">
                          {Math.round(bearing ?? 0)}°
                        </span>{" "}
                        burchakda — yuzni shu yo'nalishga buring.
                      </p>
                    </div>
                  )}

                  {orientationStatus === "unsupported" && (
                    <div className="mt-3 rounded-xl bg-elevated p-3 flex items-start gap-2">
                      <Compass size={14} className="text-tertiary shrink-0 mt-0.5" />
                      <p className="text-[11px] text-tertiary leading-relaxed">
                        Bu qurilmada kompas sensori yo'q. O'q shimoldan{" "}
                        <span className="text-primary font-semibold tabular">
                          {Math.round(bearing ?? 0)}°
                        </span>{" "}
                        burchakda turibdi — yuzni shu yo'nalishga buring.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 rounded-lg bg-elevated/40 p-2.5 text-[10px] text-tertiary space-y-1">
                    <div className="flex justify-between">
                      <span>Joylashuvingiz:</span>
                      <span className="tabular text-foreground">
                        {location.latitude.toFixed(3)},{" "}
                        {location.longitude.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ka'ba:</span>
                      <span className="tabular text-foreground">
                        {KAABA_LATITUDE.toFixed(3)},{" "}
                        {KAABA_LONGITUDE.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </section>

        <p className="text-[10px] text-tertiary text-center leading-relaxed px-2 pb-2">
          Qibla burchagi great-circle (eng qisqa yo'l) bo'yicha hisoblanadi.
          Aniqlik uchun telefonni gorizontal ushlang va metall buyumlardan uzoq turing.
        </p>
      </div>
    </BottomSheet>
  );
}
