"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrivalRateChart } from "@/components/ArrivalRateChart";
import { JoinForm } from "@/components/JoinForm";
import { NowServingStrip } from "@/components/NowServingStrip";
import { QueueStatusStrip } from "@/components/QueueStatusStrip";
import { TicketCard } from "@/components/TicketCard";
import { WaitEstimateExplainer } from "@/components/WaitEstimateExplainer";
import { WhenToVisitCard } from "@/components/WhenToVisitCard";
import { ErrorState } from "@/components/ui";
import { useHydrated } from "@/lib/hooks";
import { myTicket, useQueue } from "@/lib/store";
import { getVenue, VENUE_LIST } from "@/lib/venues";

export default function VisitorQueuePage() {
  const params = useParams<{ venue: string }>();
  const hydrated = useHydrated();
  const state = useQueue();
  const meta = getVenue(params.venue);

  /* Unknown venue → friendly error state */
  if (!meta) {
    return (
      <div className="mx-auto max-w-lg">
        <ErrorState
          icon="🧭"
          title="Venue not found"
          body={`We couldn't find a venue called “${params.venue}”. Check the QR code, or pick a demo venue below.`}
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

  /* Loading state (live local state resolves after mount) */
  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading queue">
        <div className="h-28 animate-pulse rounded-3xl bg-slate-200/60" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200/60" />
        <p className="sr-only">Loading queue…</p>
      </div>
    );
  }

  const ticket = myTicket(meta.slug);
  const closed = state.closed[meta.slug];

  return (
    <div className="space-y-6">
      {/* Venue switcher */}
      <nav aria-label="Demo venues" className="flex flex-wrap items-center gap-2">
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← Home
        </Link>
        <span aria-hidden="true" className="text-ink-300">
          |
        </span>
        {VENUE_LIST.map((v) => (
          <Link
            key={v.slug}
            href={`/q/${v.slug}`}
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

      {/* Venue header */}
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl"
          >
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black tracking-tight text-ink-900">
              {meta.name}
            </h1>
            <p className="text-xs text-ink-500">
              Open {meta.hours} · avg ~
              {Math.round(meta.avgServiceSeconds / 60)} min per person
            </p>
            <QueueStatusStrip state={state} meta={meta} className="mt-3" />
          </div>
        </div>

        {closed && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-ink-700"
          >
            ⏸ This queue is paused by staff. New tokens are unavailable — you
            can still see the current status below.
          </p>
        )}
      </header>

      {ticket ? <TicketCard ticket={ticket} /> : null}

      <NowServingStrip venue={meta.slug} />

      {ticket ? null : (
        <>
          <WhenToVisitCard state={state} meta={meta} />

          {!closed ? (
            <JoinForm venue={meta.slug} />
          ) : (
            <ErrorState
              icon="⏸"
              title="Queue paused"
              body="Staff have paused this queue, so new tokens aren't being issued. Please try again later or ask at the counter."
            />
          )}

          <WaitEstimateExplainer />

          <ArrivalRateChart meta={meta} />
        </>
      )}
    </div>
  );
}
