"use client";

import Link from "next/link";
import { useQueue } from "@/lib/store";
import type { VenueMeta } from "@/lib/venues";
import { QueueStatusStrip } from "./QueueStatusStrip";

/** Landing-page venue card: live status + visitor/staff entry points. */
export function VenueCard({ meta }: { meta: VenueMeta }) {
  const state = useQueue();

  return (
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl"
        >
          {meta.icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink-900">{meta.name}</h3>
          <p className="text-xs text-ink-500">Open {meta.hours}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-600">{meta.tagline}</p>

      <QueueStatusStrip state={state} meta={meta} className="mt-4" />

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/q/${meta.slug}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-colors hover:bg-brand-700"
        >
          Join the queue
        </Link>
        <Link
          href={`/staff/${meta.slug}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
        >
          Staff view
        </Link>
      </div>
    </article>
  );
}
