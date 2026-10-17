"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDuration, formatServiceTime } from "@/lib/format";
import { actions, useConnection, useQueue } from "@/lib/store";
import type { VenueSlug } from "@/lib/types";
import { estimateForNewJoiner, openCounterCount, waitingTickets } from "@/lib/wait";
import { VENUES } from "@/lib/venues";

/**
 * Visitor join form: optional name + optional request type.
 * Shows a live, explainable "you'd wait ≈" preview before joining and guards
 * against duplicate submissions (disabled button + idempotency key).
 */
export function JoinForm({ venue }: { venue: VenueSlug }) {
  const state = useQueue();
  const connection = useConnection();
  const meta = VENUES[venue];
  const [name, setName] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState(meta.serviceTypes[0].id);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // One key per join attempt: retrying the same attempt can't create a second
  // ticket, and the key is rotated after a success.
  const requestKeyRef = useRef<string>(createKey());

  const waiting = waitingTickets(state, venue).length;
  const est = estimateForNewJoiner(state, meta, serviceTypeId);
  const openCounters = openCounterCount(state, venue);
  const paused = state.closed[venue];
  const offline = connection.mode === "offline";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const ticket = await actions.join(venue, name, serviceTypeId, {
        requestKey: requestKeyRef.current,
      });
      if (ticket) {
        requestKeyRef.current = createKey();
        setName("");
      } else {
        setError("Couldn't join — the queue may be paused or the backend is offline.");
      }
    } catch {
      setError("Something went wrong joining the queue. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="join-heading"
    >
      <h2 id="join-heading" className="text-base font-bold text-ink-900">
        Take a token
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        No sign-up needed. A name helps staff call you; the request type
        improves the wait estimate.
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-semibold text-ink-700">
          Your name <span className="font-normal text-ink-500">(optional)</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ananya Iyer"
          maxLength={40}
          autoComplete="name"
          className="mt-1 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </label>

      {meta.serviceTypes.length > 0 && (
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-ink-700">
            What do you need?{" "}
            <span className="font-normal text-ink-500">(optional)</span>
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {meta.serviceTypes.map((type) => {
              const selected = serviceTypeId === type.id;
              return (
                <label
                  key={type.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors",
                    selected
                      ? "border-brand-500 bg-brand-50 ring-1 ring-inset ring-brand-300"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <input
                    type="radio"
                    name="serviceType"
                    value={type.id}
                    checked={selected}
                    onChange={() => setServiceTypeId(type.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span aria-hidden="true" className="text-xl">
                    {type.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-900">
                      {type.label}
                    </span>
                    <span className="block text-[11px] text-ink-500">
                      ≈ {formatServiceTime(type.avgServiceSeconds)} each
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Live, explainable estimate before joining */}
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-inset ring-slate-200">
        {openCounters === 0 ? (
          <>
            <p className="text-lg font-bold text-ink-900">
              No wait estimate yet
            </p>
            <p className="mt-1 text-xs text-ink-500">
              No counters are open right now, so there's nothing to divide the
              queue by yet. You can still take a token — service starts as soon
              as a counter reopens.
            </p>
          </>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-ink-700">
              <span className="text-lg font-bold text-ink-900">
                ≈ {waiting === 0 ? "no wait" : formatDuration(est.estimateSeconds)}
              </span>
              <span>if you join now</span>
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {waiting === 0
                ? "Nobody is waiting — you'd be called straight away."
                : `${est.ahead} ahead ÷ ${est.counters} open ${est.counters === 1 ? "counter" : "counters"} × ~${formatServiceTime(est.avgServiceSeconds)} avg.`}
            </p>
          </>
        )}
      </div>

      {openCounters === 0 && !paused ? (
        <p
          role="status"
          className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200"
        >
          All counters are closed right now — you can still take a token, but
          service won't start until a counter reopens.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Joining…" : "Join queue"}
      </button>

      {offline ? (
        <p
          role="status"
          className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200"
        >
          The backend looks offline right now — your token will be kept in this
          browser instead.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function createKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
