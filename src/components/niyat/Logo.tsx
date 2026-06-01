// Niyat — Yuksalish logo wrapper.
// /public/yuksalish.logo.png — primary brand asset.
// Logo o'zining orqa foni va dizayni bilan keladi, faqat radius beriladi.

type LogoProps = {
  size?: number;
  className?: string;
  rounded?: number; // px radius (default size/5)
  // "frame": logo + ramka (default — katta joylarda)
  // "icon": faqat logo, qora orqa fon yashirinadi (kichik menu icon uchun)
  variant?: "frame" | "icon";
};

export function NiyatLogo({
  size = 40,
  className = "",
  rounded,
  variant = "frame",
}: LogoProps) {
  const radius = rounded ?? Math.round(size / 5);

  if (variant === "icon") {
    // Kichik menu icon — mix-blend-mode: lighten orqali qora fonni
    // tagidagi konteyner foniga "ko'maytirib" yuboradi (lighter bo'laklar saqlanadi).
    return (
      <img
        src="/yuksalish.logo.png"
        alt="Niyat"
        width={size}
        height={size}
        draggable={false}
        className={`shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          mixBlendMode: "lighten",
          display: "block",
        }}
      />
    );
  }

  // frame — to'liq logo (qora fon + chegara saqlanadi)
  return (
    <img
      src="/yuksalish.logo.png"
      alt="Niyat"
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: "cover",
        display: "block",
      }}
    />
  );
}
