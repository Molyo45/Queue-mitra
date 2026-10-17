"use client";

import { cn } from "@/lib/cn";
import { dismissToast, useToasts } from "@/lib/toast";

const KIND_STYLES: Record<string, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

const KIND_ICON: Record<string, string> = {
  info: "i",
  success: "✓",
  error: "!",
};

export function ToastHost() {
  const toasts = useToasts();

  return (
    <div
      aria-live="polite"
      className="print-hide pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg shadow-slate-900/10",
            KIND_STYLES[toast.kind],
          )}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-current/10 text-xs font-bold"
          >
            {KIND_ICON[toast.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.body ? (
              <p className="mt-0.5 text-xs opacity-80">{toast.body}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.3 6.3a1 1 0 0 1 1.4 0L10 8.6l2.3-2.3a1 1 0 1 1 1.4 1.4L11.4 10l2.3 2.3a1 1 0 0 1-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 0 1-1.4-1.4L8.6 10 6.3 7.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
