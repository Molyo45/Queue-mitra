"use client";

import { cn } from "@/lib/cn";
import { useHydrated, useNow } from "@/lib/hooks";
import { actions, useConnection } from "@/lib/store";

/** The static GitHub Pages build has no backend by design. */
const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

/**
 * Slim status bar that makes the data-freshness contract visible:
 * how the queue updates (live stream / polling / local demo) and when the
 * client last received fresh data. Also offers retry / demo-mode escapes when
 * the backend is unreachable.
 */
export function BackendStatusBar() {
  const hydrated = useHydrated();
  const connection = useConnection();
  const now = useNow(1000);

  // Avoid a hydration mismatch: the connection state is client-only.
  if (!hydrated) {
    return (
      <div
        aria-hidden="true"
        className="border-b border-slate-200/70 bg-white/60"
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-1.5 sm:px-6">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200/70" />
        </div>
      </div>
    );
  }

  const { mode, transport, lastRefreshedAt, lastError } = connection;
  const secondsAgo =
    lastRefreshedAt === 0
      ? null
      : Math.max(0, Math.round((now - lastRefreshedAt) / 1000));

  const freshness =
    secondsAgo === null
      ? "waiting for data…"
      : secondsAgo <= 2
        ? "updated just now"
        : secondsAgo < 60
          ? `updated ${secondsAgo}s ago`
          : `updated ${Math.round(secondsAgo / 60)} min ago`;

  const tone: "live" | "polling" | "offline" | "local" | "connecting" =
    mode === "live"
      ? "live"
      : mode === "polling"
        ? "polling"
        : mode === "offline"
          ? "offline"
          : mode === "local"
            ? "local"
            : "connecting";

  const styles: Record<typeof tone, string> = {
    live: "bg-emerald-50 text-emerald-800",
    polling: "bg-amber-50 text-amber-900",
    offline: "bg-rose-50 text-rose-800",
    local: "bg-amber-50 text-amber-900",
    connecting: "bg-slate-50 text-ink-600",
  };

  const dot: Record<typeof tone, string> = {
    live: "bg-emerald-500",
    polling: "bg-amber-500",
    offline: "bg-rose-500",
    local: "bg-amber-500",
    connecting: "bg-slate-400",
  };

  const label =
    mode === "live"
      ? "Live"
      : mode === "polling"
        ? "Near-live"
        : mode === "offline"
          ? "Backend unreachable"
          : mode === "local"
            ? IS_STATIC_EXPORT
              ? "Demo mode"
              : "Local demo mode"
            : "Connecting…";

  const detail =
    mode === "live"
      ? "streaming updates"
      : mode === "polling"
        ? "refreshing every few seconds"
        : mode === "offline"
          ? lastError ?? "showing the last data we received"
          : mode === "local"
            ? IS_STATIC_EXPORT
              ? "static build · data stays in this browser"
              : "backend offline · data stays in this browser"
            : "checking for the backend";

  const canRetry = !IS_STATIC_EXPORT && (mode === "offline" || mode === "local");

  return (
    <div className={cn("border-b border-slate-200/70", styles[tone])}>
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:px-6">
        <span role="status" className="flex items-center gap-1.5 font-semibold">
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 rounded-full",
              dot[tone],
              mode === "live" && "animate-pulse",
            )}
          />
          {label}
        </span>
        <span className="opacity-80">{detail}</span>
        <span className="opacity-70">· {freshness}</span>
        {transport === "sse" && (
          <span className="hidden opacity-60 sm:inline">· realtime</span>
        )}

        {canRetry && (
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void actions.retry()}
              className="rounded-full bg-white/70 px-2.5 py-0.5 font-semibold ring-1 ring-inset ring-current/20 transition-colors hover:bg-white"
            >
              Retry
            </button>
            {mode === "offline" && (
              <button
                type="button"
                onClick={() => actions.useLocalMode("Switched to local demo mode.")}
                className="rounded-full bg-white/70 px-2.5 py-0.5 font-semibold ring-1 ring-inset ring-current/20 transition-colors hover:bg-white"
              >
                Use demo mode
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
