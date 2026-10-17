"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CounterCard } from "@/components/CounterCard";
import { SimulatePanel } from "@/components/SimulatePanel";
import { StaffPinGate } from "@/components/StaffPinGate";
import { StaffStats } from "@/components/StaffStats";
import { RecentTickets, TicketList } from "@/components/TicketList";
import { ErrorState, Pill } from "@/components/ui";
import { useHydrated, useAsyncAction } from "@/lib/hooks";
import { actions, useQueue } from "@/lib/store";
import { getVenue, VENUE_LIST } from "@/lib/venues";
import { venueCounters, waitingTickets } from "@/lib/wait";

export default function StaffPage() {
  const params = useParams<{ venue: string }>();
  const hydrated = useHydrated();
  const state = useQueue();
  const pauseAction = useAsyncAction();
  const meta = getVenue(params.venue);

  if (!meta) {
    return (
      <div className="mx-auto max-w-lg">
        <ErrorState
          icon="🧭"
          title="Venue not found"
          body={`No staff dashboard exists for “${params.venue}”.`}
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Back to venues
          </Link>
        </ErrorState>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-16 animate-pulse rounded-3xl bg-slate-200/60" />
        <div className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />
        <div className="h-56 animate-pulse rounded-3xl bg-slate-200/60" />
      </div>
    );
  }

  const counters = venueCounters(state, meta.slug);
  const closed = state.closed[meta.slug];
  const waitingNow = waitingTickets(state, meta.slug).length;

  return (
    <StaffPinGate venue={meta.slug}>
      <div className="space-y-6">
        {/* Venue switcher */}
        <nav aria-label="Venues" className="flex flex-wrap items-center gap-2">
          <Link href="/" className="text-sm text-brand-700 hover:underline">
            ← Home
          </Link>
          <span aria-hidden="true" className="text-ink-300">
            |
          </span>
          {VENUE_LIST.map((v) => (
            <Link
              key={v.slug}
              href={`/staff/${v.slug}`}
              aria-current={v.slug === meta.slug ? "page" : undefined}
              className={
                v.slug === meta.slug
                  ? "rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              }
            >
              {v.icon} {v.shortName}
            </Link>
          ))}
        </nav>

        {/* Header + open/close control */}
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight text-ink-900">
                {meta.icon} {meta.name} — Staff dashboard
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <Pill tone={closed ? "closed" : "quiet"}>
                  {closed ? "⏸ Queue paused" : "● Accepting tokens"}
                </Pill>
                <span>
                  {waitingNow} waiting · {counters.filter((c) => c.active).length}{" "}
                  of {counters.length} counters open
                </span>
              </p>
            </div>

            <button
              type="button"
              disabled={pauseAction.pending}
              onClick={() =>
                void pauseAction.run(() => actions.toggleClosed(meta.slug))
              }
              className={
                closed
                  ? "inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  : "inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {pauseAction.pending
                ? "Saving…"
                : closed
                  ? "Reopen queue"
                  : "Pause new tokens"}
            </button>
          </div>
        </header>

        <StaffStats state={state} venue={meta.slug} />

        {/* Counters */}
        <section aria-labelledby="counters-heading">
          <h2
            id="counters-heading"
            className="text-base font-bold text-ink-900"
          >
            Counters
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {counters.map((counter) => (
              <CounterCard key={counter.id} counter={counter} />
            ))}
          </div>
        </section>

        <SimulatePanel venue={meta.slug} />

        {/* Waiting queue */}
        <section aria-labelledby="queue-heading">
          <h2 id="queue-heading" className="text-base font-bold text-ink-900">
            Waiting queue ({waitingNow})
          </h2>
          <div className="mt-3">
            <TicketList venue={meta.slug} />
          </div>
        </section>

        {/* Recently closed */}
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-base font-bold text-ink-900">
            Recently closed
          </h2>
          <div className="mt-3">
            <RecentTickets venue={meta.slug} />
          </div>
        </section>
      </div>
    </StaffPinGate>
  );
}
