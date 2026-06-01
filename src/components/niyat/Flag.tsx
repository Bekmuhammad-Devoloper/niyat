// Inline SVG bayroqlar — Windows brauzerda emoji ishlamaydi, offline mobile'da
// ham ishlashi uchun inline yozilgan. Asosiy 5 ta til uchun.

type FlagProps = {
  code: string;
  size?: number;
  className?: string;
};

// ratio 3:2 (height = width * 2/3)
function FlagFrame({ children, size, className }: {
  children: React.ReactNode;
  size: number;
  className?: string;
}) {
  const h = Math.round(size * (2 / 3));
  return (
    <span
      className={`inline-block shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: h,
        borderRadius: 2,
        overflow: "hidden",
        verticalAlign: "middle",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <svg
        viewBox="0 0 30 20"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-hidden
      >
        {children}
      </svg>
    </span>
  );
}

export function Flag({ code, size = 20, className }: FlagProps) {
  const c = code.toLowerCase().slice(0, 2);
  if (c === "uz") return <UzFlag size={size} className={className} />;
  if (c === "ru") return <RuFlag size={size} className={className} />;
  if (c === "us" || c === "en") return <UsFlag size={size} className={className} />;
  if (c === "gb") return <GbFlag size={size} className={className} />;
  if (c === "tr") return <TrFlag size={size} className={className} />;
  if (c === "sa") return <SaFlag size={size} className={className} />;
  return <UnknownFlag size={size} className={className} />;
}

function UzFlag({ size, className }: { size: number; className?: string }) {
  return (
    <FlagFrame size={size} className={className}>
      {/* Blue, white (with thin red strips), green */}
      <rect width="30" height="6.67" fill="#1eb53a" y="13.33" />
      <rect width="30" height="0.5" fill="#ce1126" y="6.17" />
      <rect width="30" height="6.0" fill="#ffffff" y="6.67" />
      <rect width="30" height="0.5" fill="#ce1126" y="13.33" />
      <rect width="30" height="6.67" fill="#0099b5" y="0" />
      {/* Crescent + 12 stars (simplified — just crescent and a star) */}
      <circle cx="5.5" cy="3.5" r="2.0" fill="#ffffff" />
      <circle cx="6.4" cy="3.3" r="1.8" fill="#0099b5" />
      <text x="9" y="4.6" fill="#ffffff" fontSize="1.5">★</text>
      <text x="10.5" y="3.2" fill="#ffffff" fontSize="1.3">★</text>
      <text x="11" y="5" fill="#ffffff" fontSize="1.3">★</text>
    </FlagFrame>
  );
}

function RuFlag({ size, className }: { size: number; className?: string }) {
  return (
    <FlagFrame size={size} className={className}>
      <rect width="30" height="6.67" fill="#ffffff" y="0" />
      <rect width="30" height="6.67" fill="#0039a6" y="6.67" />
      <rect width="30" height="6.67" fill="#d52b1e" y="13.33" />
    </FlagFrame>
  );
}

function UsFlag({ size, className }: { size: number; className?: string }) {
  return (
    <FlagFrame size={size} className={className}>
      <rect width="30" height="20" fill="#bf0a30" />
      {/* 13 stripes (we'll do 7 red, 6 white, simplified) */}
      <rect width="30" height="1.54" y="1.54" fill="#ffffff" />
      <rect width="30" height="1.54" y="4.61" fill="#ffffff" />
      <rect width="30" height="1.54" y="7.69" fill="#ffffff" />
      <rect width="30" height="1.54" y="10.77" fill="#ffffff" />
      <rect width="30" height="1.54" y="13.85" fill="#ffffff" />
      <rect width="30" height="1.54" y="16.92" fill="#ffffff" />
      {/* Canton (blue square with stars) */}
      <rect width="12" height="10.77" fill="#002868" />
      <text x="1" y="3" fill="#ffffff" fontSize="2">★ ★ ★</text>
      <text x="1" y="6" fill="#ffffff" fontSize="2">★ ★ ★</text>
      <text x="1" y="9" fill="#ffffff" fontSize="2">★ ★ ★</text>
    </FlagFrame>
  );
}

function GbFlag({ size, className }: { size: number; className?: string }) {
  return (
    <FlagFrame size={size} className={className}>
      <rect width="30" height="20" fill="#012169" />
      {/* White diagonal cross */}
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#ffffff" strokeWidth="3" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#c8102e" strokeWidth="1.2" />
      {/* White cross */}
      <rect x="13" width="4" height="20" fill="#ffffff" />
      <rect y="8" width="30" height="4" fill="#ffffff" />
      {/* Red cross */}
      <rect x="14" width="2" height="20" fill="#c8102e" />
      <rect y="9" width="30" height="2" fill="#c8102e" />
    </FlagFrame>
  );
}

function TrFlag({ size, className }: { size: number; className?: string }) {
  return (
    <FlagFrame size={size} className={className}>
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="11.5" cy="10" r="4.5" fill="#ffffff" />
      <circle cx="13" cy="10" r="3.6" fill="#e30a17" />
      <text x="15.5" y="11.2" fill="#ffffff" fontSize="4">★</text>
    </FlagFrame>
  );
}

function SaFlag({ size, className }: { size: number; className?: string }) {
  return (
    <FlagFrame size={size} className={className}>
      <rect width="30" height="20" fill="#006c35" />
      <text
        x="15"
        y="9"
        fill="#ffffff"
        fontSize="3.5"
        textAnchor="middle"
        fontFamily="serif"
      >
        لا إله إلا الله
      </text>
      <rect x="4" y="12" width="22" height="0.8" fill="#ffffff" />
    </FlagFrame>
  );
}

function UnknownFlag({ size, className }: { size: number; className?: string }) {
  return (
    <FlagFrame size={size} className={className}>
      <rect width="30" height="20" fill="#2a2a2a" />
      <text x="15" y="13" fill="#ffffff" fontSize="6" textAnchor="middle">
        ?
      </text>
    </FlagFrame>
  );
}
