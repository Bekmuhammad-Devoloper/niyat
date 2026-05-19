import { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="phone-frame">
        <div className="phone-notch" />
        {children}
      </div>
    </div>
  );
}
