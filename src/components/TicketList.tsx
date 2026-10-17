"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatAgo, formatClock } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { actions, useQueue } from "@/lib/store";
import type { Ticket, VenueSlug } from "@/lib/types";
import { serviceTypeById, VENUES } from "@/lib/venues";
import { estimateForTicket, positionOf, venueTickets, waitingTickets } from "@/lib/wait";
import { EmptyState } from "./ui";

const STATUS_LABEL: Record<Ticket["status"], string> = {
  waiting: "Waiting",
  called: "At counter",
  served: "Served",
  skipped: "Left",
  noshow: "No-show",
};

const STATUS_CLASS: Record<Ticket["status"], string> = {
  waiting: "bg-brand-100 text-brand-800",
  called: "bg-amber-100 text-amber-900",
  served: "bg-emerald-100 text-emerald-800",
  skipped: "bg-slate-100 text-slate-600",
  noshow: "bg-rose-100 text-rose-800",
};

/** The live waiting queue with row-level staff actions. */
export function TicketList({ venue }: { venue: VenueSlug }) {
  const state = useQueue();
  const now = useNow(5000);
  const waiting = waitingTickets(state, venue);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const locked = useRef(false);

  const firstFreeCounter = state.counters.find(
    (c) => c.venue === venue && c.active && !c.currentTicketId,
  );

  async function run(key: string, fn: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true;
    setBusyKey(key);
    try {
      await fn();
    } finally {
      locked.current = false;
      setBusyKey(null);
    }
  }

  if (waiting.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="No one is waiting"
        body="The queue is empty right now. Try “Simulate walk-in” below to see how the line builds up."
      />
    );
  }

  return (
    <ol className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {waiting.map((ticket) => {
        const ahead = positionOf(state, ticket);
        const est = estimateForTicket(state, ticket);
        const type = serviceTypeById(VENUES[venue], ticket.serviceTypeId);
        const callKey = `call:${ticket.id}`;
        const noShowKey = `noshow:${ticket.id}`;
        return (
          <li
            key={ticket.id}
            className="flex flex-wrap items-center gap-3 p-3 sm:p-4"
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-ink-600"
            >
              {ahead}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-ink-900">
                  {ticket.no}
                </span>
                <span className="truncate text-sm text-ink-700">
                  {ticket.name}
                </span>
                {ticket.isSimulated && (
                  <span
                    title="Simulated visitor (demo)"
                    className="rounded-full border border-dashed border-slate-300 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-400"
                  >
                    sim
                  </span>
                )}
              </p>
              <p className="text-[11px] text-ink-500">
                joined {formatAgo(ticket.joinedAt, now)} · ≈{" "}
                {Math.max(1, Math.round(est.estimateSeconds / 60))} min wait
                {type ? ` · ${type.icon} ${type.label}` : ""}
              </p>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                disabled={!firstFreeCounter || busyKey !== null}
                onClick={() =>
                  firstFreeCounter &&
                  void run(callKey, () => actions.callNext(venue, firstFreeCounter.id))
                }
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                {busyKey === callKey
                  ? "Calling…"
                  : firstFreeCounter
                    ? `Call to ${firstFreeCounter.label}`
                    : "No counter free"}
              </button>
              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => void run(noShowKey, () => actions.markNoShow(ticket.id))}
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                {busyKey === noShowKey ? "Saving…" : "No-show"}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** When a closed ticket was closed (best available timestamp). */
function closedAt(t: Ticket): number {
  return t.servedAt ?? t.calledAt ?? t.joinedAt;
}

/** Recently closed tickets (served / left / no-show) with a recall action. */
export function RecentTickets({ venue }: { venue: VenueSlug }) {
  const state = useQueue();
  const [recallingId, setRecallingId] = useState<string | null>(null);
  const locked = useRef(false);

  const recent = venueTickets(state, venue)
    .filter(
      (t) =>
        t.status === "served" || t.status === "noshow" || t.status === "skipped",
    )
    // Most recently closed first (fall back to when it was called/joined).
    .sort((a, b) => closedAt(b) - closedAt(a))
    .slice(0, 6);

  async function recall(id: string) {
    if (locked.current) return;
    locked.current = true;
    setRecallingId(id);
    try {
      await actions.recall(id);
    } finally {
      locked.current = false;
      setRecallingId(null);
    }
  }

  if (recent.length === 0) return null;

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {recent.map((ticket) => (
        <li
          key={ticket.id}
          className="flex flex-wrap items-center gap-3 p-3 sm:px-4 sm:py-3"
        >
          <span className="font-mono text-sm font-bold text-ink-700">
            {ticket.no}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink-600">
            {ticket.name}
          </span>
          {ticket.servedAt && (
            <span className="text-[11px] text-ink-500">
              done {formatClock(ticket.servedAt)}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              STATUS_CLASS[ticket.status],
            )}
          >
            {STATUS_LABEL[ticket.status]}
          </span>
          {(ticket.status === "noshow" || ticket.status === "skipped") && (
            <button
              type="button"
              disabled={recallingId !== null}
              onClick={() => void recall(ticket.id)}
              className="inline-flex min-h-9 items-center rounded-xl px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {recallingId === ticket.id ? "Recalling…" : "Recall"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
