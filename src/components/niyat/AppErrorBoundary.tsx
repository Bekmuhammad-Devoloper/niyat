import { Component, type ReactNode } from "react";

// Mobil APK uchun global error boundary — biror komponent crash bo'lsa,
// ilova butunlay yopilmaydi, balki foydalanuvchiga xato ko'rsatadi.
// Bu DevTools yo'q telefonda critical, chunki crash sababi nima ekanini
// foydalanuvchi ko'rishi mumkin va menga aytishi mumkin.

type State = { error: Error | null };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[AppErrorBoundary] crash:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-5">
            <h1 className="text-[18px] font-semibold text-destructive mb-2">
              Kutilmagan xato
            </h1>
            <p className="text-[13px] text-tertiary mb-4 leading-relaxed">
              Ilovani qayta ishga tushirib ko'ring. Agar yana takrorlansa,
              quyidagi xatoni dasturchiga yuboring:
            </p>
            <pre className="text-[11px] font-mono bg-elevated/40 rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap break-words">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack?.split("\n").slice(0, 8).join("\n")}
            </pre>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              className="mt-4 w-full h-11 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold"
            >
              Qayta urinish
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
