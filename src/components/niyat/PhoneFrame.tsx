import { ReactNode } from "react";

// Mobil ilova (Capacitor APK)da telefon ramkasi kerakmas — to'g'ridan-to'g'ri
// to'liq ekran ko'rsatamiz. Vite mobile build'da VITE_IS_MOBILE=true.
const IS_MOBILE_APP =
  (import.meta.env.VITE_IS_MOBILE as boolean | undefined) === true;

export function PhoneFrame({ children }: { children: ReactNode }) {
  if (IS_MOBILE_APP) {
    // Mobil ilovada — viewport balandligida QOTGAN konteyner.
    // `h-[100dvh]` (dynamic viewport height) — telefonning address bar / soft
    // navigation bar yashirin/ko'rinib turishiga moslashadi.
    // `overflow-hidden` — root scroll bo'lmasin, faqat ichki ekran scroll bo'lsin.
    // Bu TabBar'ning doim eng pastda turishini ta'minlaydi.
    //
    // safe-area-inset-top — Android status bar + iOS notch ostida kontent
    // ko'rinib qolishini oldini oladi. Capacitor `overlaysWebView: false`
    // ham yordam beradi, lekin barcha qurilmalarda emas. CSS env() universalroq.
    return (
      <div
        className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="phone-frame">
        <div className="phone-notch" />
        {children}
      </div>
    </div>
  );
}
