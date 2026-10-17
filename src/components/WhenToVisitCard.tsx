"use client";

import { cn } from "@/lib/cn";
import { formatDuration, formatHour, formatServiceTime } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import type { QueueState } from "@/lib/types";
import type { VenueMeta } from "@/lib/venues";
import {
  bestLaterSlot,
  busyLevel,
  estimateForNewJoiner,
  openCounterCount,
  recentArrivalRate,
  waitingTickets,
} from "@/lib/wait";
import { SampleDataBadge } from "./ui";

/**
 * "Should I come now or later?"
 *
 *  Now   = LIVE numbers (the real queue) plus a *recent* arrival rate observed
 *          from this queue over the last hour.
 *  Later = a rough estimate from **demo** arrival-rate assumptions, using the
 *          same formula as the live estimate.
 *
 * Both arrival-rate sources are clearly labelled, and the whole card says
 * plainly that these are estimates — a guide, not a guarantee.
 */
export function WhenToVisitCard({
  state,
  meta,
  className,
}: {
  state: QueueState;
  meta: VenueMeta;
  className?: string;
}) {
  const now = useNow(30_000);
  const waiting = waitingTickets(state, meta.slug).length;
  const closed = state.closed[meta.slug];
  const openNow = openCounterCount(state, meta.slug);
  const noCounters = !closed && openNow === 0;
  const level = busyLevel(meta, waiting);
  const nowEst = estimateForNewJoiner(state, meta);
  const later = bestLaterSlot(state, meta, new Date(now));
  const recent = recentArrivalRate(state, meta, now);

  const levelPhrase =
    level === "quiet" ? "quiet" : level === "moderate" ? "getting busy" : "very busy";

  const verdict = closed
    ? "The queue is paused right now — check back in a bit."
    : level === "quiet"
      ? "Good time to visit — the queue is short right now."
      : later
        ? `It's ${levelPhrase} right now. Around ${formatHour(later.hour)} is usually quieter.`
        : `It's ${levelPhrase} right now — earlier in the day is usually quietest.`;

  const recentLabel = recent.reliable
    ? `≈ ${recent.per10Min} arriving / 10 min`
    : recent.count === 0
      ? "no arrivals logged yet"
      : `${recent.count} arrival${recent.count === 1 ? "" : "s"} / ${recent.windowMinutes} min`;

  return (
    <section
      aria-labelledby="when-to-visit"
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="when-to-visit" className="text-sm font-semibold text-ink-900">
          Should I come now or later?
        </h2>
        <SampleDataBadge />
      </div>

      <p className="mt-2 text-sm font-medium text-ink-700">{verdict}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Now — live */}
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Right now · live
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900">
            {closed
              ? "Paused"
              : noCounters
                ? "Waiting"
                : nowEst.estimateSeconds === 0
                  ? "No wait"
                  : `≈ ${formatDuration(nowEst.estimateSeconds)}`}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {closed
              ? "Not accepting new tokens"
              : noCounters
                ? "All counters are closed right now"
                : `${waiting} in the real queue · ${levelPhrase}`}
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            Recent arrivals: {recentLabel}
            <span className="opacity-70"> · last {recent.windowMinutes} min</span>
          </p>
        </div>

        {/* Later — demo arrival-rate estimate */}
        <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-inset ring-brand-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {later ? `Typical at ${formatHour(later.hour)}` : "Later today"}
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900">
            {later ? `≈ ${formatDuration(later.estimateSeconds)}` : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-600">
            {later
              ? `${later.arrivalsPer10Min} arrive / 10 min (demo) ÷ ${later.counters} ${later.counters === 1 ? "counter" : "counters"} × ${formatServiceTime(later.avgServiceSeconds)}`
              : "Outside opening hours"}
          </p>
        </div>
      </div>

      {!closed && later && (
        <p className="mt-3 text-xs font-medium text-ink-600">
          {later.isQuiet
            ? `👍 ${formatHour(later.hour)} looks like a good time to come.`
            : `Best remaining slot today is around ${formatHour(later.hour)}.`}
        </p>
      )}

      <details className="mt-3 text-xs text-ink-600">
        <summary className="cursor-pointer font-medium text-brand-700">
          How is this calculated?
        </summary>
        <div className="mt-2 space-y-1.5">
          <p>
            <strong>Now</strong> uses the live queue:{" "}
            <span className="font-mono">
              (people ahead ÷ open counters) × average service time
            </span>
            . “Recent arrivals” is counted from tickets that actually joined this
            queue in the last hour — a live signal, though it is noisy when few
            people have joined.
          </p>
          <p>
            <strong>Later</strong> swaps “people ahead” for the venue's{" "}
            <em>demo arrival rate</em> — an assumed number of visitors per 10
            minutes for that hour. It reuses the same formula for consistency.
          </p>
          <p className="text-ink-500">
            Both are rough, explainable estimates — not AI and not a guarantee.
            The hourly arrival-rate assumptions are simulated sample data; only
            the live queue is measured.
          </p>
        </div>
      </details>
    </section>
  );
}
