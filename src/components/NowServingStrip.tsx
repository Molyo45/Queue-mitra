"use client";

import { useNow } from "@/lib/hooks";
import { useQueue } from "@/lib/store";
import type { VenueSlug } from "@/lib/types";
import { VENUES } from "@/lib/venues";

/**
 * Compact "who is at the counter right now" strip for the visitor page.
 * Reinforces that the visitor and staff screens stay in sync from one
 * shared local queue.
 */
export function NowServingStrip({ venue }: { venue: VenueSlug }) {
  const state = useQueue();
  const now = useNow(5000);
  const meta = VENUES[venue];

  const serving = state.counters
    .filter((c) => c.venue === venue && c.currentTicketId)
    .map((c) => ({
      counter: c,
      ticket: state.tickets.find((t) => t.id === c.currentTicketId),
    }))
    .filter((row) => row.ticket);

  if (serving.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-ink-500">
        No one is at the counter right now.
      </p>
    );
  }

  return (
    <section
      aria-label={`Now serving at ${meta.name}`}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        Now serving
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {serving.map(({ counter, ticket }) => (
          <li key={counter.id} className="flex items-center gap-2 text-sm">
            <span className="text-xs text-ink-500">{counter.label}</span>
            <span className="font-mono font-bold text-ink-900">{ticket!.no}</span>
            <span className="truncate text-ink-600">{ticket!.name}</span>
            {ticket!.calledAt ? (
              <span className="tabular-nums text-[11px] text-ink-500">
                ({Math.max(1, Math.round((now - ticket!.calledAt) / 60_000))} min)
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
