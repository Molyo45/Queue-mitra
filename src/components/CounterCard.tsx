"use client";

import { cn } from "@/lib/cn";
import { useAsyncAction, useNow } from "@/lib/hooks";
import { actions, useQueue } from "@/lib/store";
import type { Counter } from "@/lib/types";
import { serviceTypeById, VENUES } from "@/lib/venues";

/**
 * A single service counter: who's being served, how long they've been there,
 * and the staff controls (call next / mark served / no-show / switch off).
 *
 * Buttons lock while their request is in flight so an accidental double-tap
 * can't fire the same action twice.
 */
export function CounterCard({ counter }: { counter: Counter }) {
  const state = useQueue();
  const now = useNow(1000);
  const call = useAsyncAction();
  const toggle = useAsyncAction();
  const serve = useAsyncAction();
  const noShow = useAsyncAction();

  const current = state.tickets.find((t) => t.id === counter.currentTicketId);
  const servingSeconds = current?.calledAt ? (now - current.calledAt) / 1000 : 0;
  const currentType = current
    ? serviceTypeById(VENUES[counter.venue], current.serviceTypeId)
    : undefined;

  const firstActiveFreeCounter = state.counters.find(
    (c) => c.venue === counter.venue && c.active && !c.currentTicketId,
  );

  const busy = call.pending || toggle.pending || serve.pending || noShow.pending;

  return (
    <article
      className={cn(
        "rounded-3xl border bg-white p-4 shadow-sm sm:p-5",
        counter.active ? "border-slate-200" : "border-slate-200 opacity-60",
      )}
      aria-label={`${counter.label}${counter.active ? "" : " (switched off)"}`}
      aria-busy={busy}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink-900">{counter.label}</h3>
        <button
          type="button"
          role="switch"
          aria-checked={counter.active}
          disabled={toggle.pending}
          onClick={() => void toggle.run(() => actions.toggleCounter(counter.id))}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            counter.active
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-200 text-slate-600",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 rounded-full",
              counter.active ? "bg-emerald-500" : "bg-slate-400",
            )}
          />
          {counter.active ? "Open" : "Off"}
        </button>
      </div>

      {current ? (
        <>
          <div className="mt-3 rounded-2xl bg-brand-50 p-3 ring-1 ring-inset ring-brand-100">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              Now serving
            </p>
            <p className="mt-0.5 font-mono text-2xl font-black text-ink-900">
              {current.no}
            </p>
            <p className="text-xs text-ink-600">
              {current.name} · at counter for{" "}
              <span className="tabular-nums">
                {Math.max(1, Math.round(servingSeconds / 60))} min
              </span>
            </p>
            {currentType ? (
              <p className="text-[11px] text-ink-500">
                <span aria-hidden="true">{currentType.icon}</span>{" "}
                {currentType.label}
              </p>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={serve.pending}
              onClick={() => void serve.run(() => actions.markServed(current.id))}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {serve.pending ? "Saving…" : "Mark served"}
            </button>
            <button
              type="button"
              disabled={noShow.pending}
              onClick={() => void noShow.run(() => actions.markNoShow(current.id))}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              No-show
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 p-3 text-center">
            <p className="text-xs text-ink-500">No one at this counter</p>
          </div>
          <button
            type="button"
            disabled={!counter.active || call.pending}
            onClick={() => void call.run(() => actions.callNext(counter.venue, counter.id))}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {call.pending ? "Calling…" : "Call next"}
          </button>
        </>
      )}

      {/* Helper: if another counter is idle, hint that calling there is fine */}
      {current && firstActiveFreeCounter && (
        <p className="mt-2 text-[11px] text-ink-500">
          {firstActiveFreeCounter.label} is free — serve this one to keep the
          line moving.
        </p>
      )}
    </article>
  );
}
