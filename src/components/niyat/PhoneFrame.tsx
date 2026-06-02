import { ReactNode } from "react";

// Mobil ilova (Capacitor APK)da telefon ramkasi kerakmas — to'g'ridan-to'g'ri
// to'liq ekran ko'rsatamiz. Vite mobile build'da VITE_IS_MOBILE=true.
const IS_MOBILE_APP =
  (import.meta.env.VITE_IS_MOBILE as boolean | undefined) === true;

export function PhoneFrame({ children }: { children: ReactNode }) {
  if (IS_MOBILE_APP) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-background">
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
