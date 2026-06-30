// Chiroyli React tasdiqlash modal — window.confirm()'ning
// "https://localhost dagi sahifa ko'rsatadi" turidagi xunuk dialogi o'rniga.
//
// Foydalanish:
//   const { confirm, dialog } = useConfirmDialog();
//   const ok = await confirm({ title: "O'chirilsinmi?", message: "...", danger: true });
//   if (ok) remove();
//   return <>...{dialog}</>;

import { useCallback, useState, type ReactNode } from "react";

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: ((v: boolean) => void) | null;
};

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

const INITIAL: ConfirmState = {
  open: false,
  title: "Tasdiqlash",
  message: "",
  confirmLabel: "Davom etish",
  cancelLabel: "Bekor qilish",
  danger: false,
  resolve: null,
};

export function useConfirmDialog(): {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [state, setState] = useState<ConfirmState>(INITIAL);

  const confirm = useCallback(
    (opts: ConfirmOpts): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        setState({
          open: true,
          title: opts.title ?? "Tasdiqlash",
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? "Davom etish",
          cancelLabel: opts.cancelLabel ?? "Bekor qilish",
          danger: opts.danger ?? false,
          resolve,
        });
      }),
    [],
  );

  const handleClose = (result: boolean) => {
    state.resolve?.(result);
    setState(INITIAL);
  };

  const dialog: ReactNode = !state.open ? null : (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 fade-up"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose(false);
      }}
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-2xl">
        <p className="text-[16px] font-semibold text-foreground">{state.title}</p>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">
          {state.message}
        </p>
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="h-10 px-4 rounded-lg text-[13px] font-medium text-foreground bg-elevated hover:bg-elevated/70 active:scale-[0.98] transition"
          >
            {state.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => handleClose(true)}
            autoFocus
            className={`h-10 px-4 rounded-lg text-[13px] font-semibold active:scale-[0.98] transition ${
              state.danger
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return { confirm, dialog };
}
