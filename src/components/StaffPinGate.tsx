"use client";

import { useEffect, useState, type ReactNode } from "react";
import { actions } from "@/lib/store";
import type { VenueSlug } from "@/lib/types";
import { ErrorState } from "./ui";

/**
 * Lightweight PIN gate for the staff dashboard.
 *
 * In backend mode the PIN is verified by the server (`POST /api/staff/session`)
 * and the value is kept in sessionStorage so staff actions can send it. In
 * local demo mode it falls back to the documented demo PIN. This is a UI
 * stand-in for real authentication.
 */
export function StaffPinGate({
  venue,
  children,
}: {
  venue: VenueSlug;
  children: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [demoHint, setDemoHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(window.sessionStorage.getItem(`qm-staff-${venue}`) === "1");
    } catch {
      /* ignore */
    }
    setChecked(true);
  }, [venue]);

  // Ask the backend (or local demo store) whether to show a demo PIN hint.
  useEffect(() => {
    let cancelled = false;
    void actions.demoPinHint().then((hint) => {
      if (!cancelled) setDemoHint(hint);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await actions.staffLogin(pin);
      if (result.ok) {
        try {
          window.sessionStorage.setItem(`qm-staff-${venue}`, "1");
        } catch {
          /* ignore */
        }
        setDemoHint(result.demoPinHint ?? null);
        setUnlocked(true);
      } else {
        setError(result.error ?? "Incorrect PIN.");
      }
    } finally {
      setPending(false);
    }
  }

  if (!checked) {
    return (
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" aria-hidden="true" />
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md">
      <form
        onSubmit={submit}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold text-ink-900">Staff access</h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter the venue PIN to manage this queue.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-semibold text-ink-700">Venue PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 6))}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "pin-error" : undefined}
            className="mt-1 min-h-11 w-full rounded-2xl border border-slate-300 px-4 py-2.5 font-mono text-lg tracking-[0.4em] text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            placeholder="••••"
          />
        </label>

        {error && (
          <p
            id="pin-error"
            role="alert"
            className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Checking…" : "Unlock dashboard"}
        </button>

        <p className="mt-3 text-center text-xs text-ink-500">
          {demoHint ? (
            <>
              Demo PIN:{" "}
              <span className="font-mono font-semibold text-ink-600">
                {demoHint}
              </span>
            </>
          ) : (
            "Set STAFF_PIN in your environment for a custom PIN."
          )}
        </p>
      </form>

      <div className="mt-4">
        <ErrorState
          icon="🔐"
          title="Staff-only area"
          body="Visitors never see this screen — they only need the QR code. This PIN is a stand-in for real authentication."
        />
      </div>
    </div>
  );
}
