import type { QueueState, Ticket, VenueSlug } from "./types";
import {
  serviceTypeById,
  VENUES,
  type VenueMeta,
} from "./venues";

/* ---------------------------------------------------------------
   Queue math — deliberately simple and explainable, which matters
   for a hackathon demo. It is NOT AI and NOT a guarantee:

     estimated wait = (people ahead / open counters)
                       x average service time

   The "average service time" is the mean service time of the people
   ahead of you (each may have chosen a different request type), or
   your own request type when the queue is empty.
   --------------------------------------------------------------- */

export function venueTickets(state: QueueState, venue: VenueSlug): Ticket[] {
  return state.tickets
    .filter((t) => t.venue === venue)
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

export function waitingTickets(state: QueueState, venue: VenueSlug): Ticket[] {
  return venueTickets(state, venue).filter((t) => t.status === "waiting");
}

export function venueCounters(state: QueueState, venue: VenueSlug) {
  return state.counters.filter((c) => c.venue === venue);
}

/** Raw number of open counters (can be 0) — used for UI messaging. */
export function openCounterCount(state: QueueState, venue: VenueSlug): number {
  return venueCounters(state, venue).filter((c) => c.active).length;
}

/**
 * Divisor for wait math. Never zero, so an estimate stays finite even when
 * every counter is switched off (the UI flags that state separately).
 */
export function activeCounterCount(state: QueueState, venue: VenueSlug): number {
  return Math.max(1, openCounterCount(state, venue));
}

/** How many people are waiting in front of this ticket. */
export function ticketsAhead(state: QueueState, ticket: Ticket): number {
  return waitingTickets(state, ticket.venue).filter(
    (t) => t.joinedAt < ticket.joinedAt,
  ).length;
}

/** 1-based position in the waiting line, or null if not waiting. */
export function positionOf(state: QueueState, ticket: Ticket): number | null {
  if (ticket.status !== "waiting") return null;
  const list = waitingTickets(state, ticket.venue);
  const idx = list.findIndex((t) => t.id === ticket.id);
  return idx === -1 ? null : idx + 1;
}

/* ------------------------------ estimates ------------------------------ */

/** The service time assumed for a single ticket. */
export function serviceSecondsFor(ticket: Ticket, meta: VenueMeta): number {
  const type = serviceTypeById(meta, ticket.serviceTypeId);
  return type?.avgServiceSeconds ?? meta.avgServiceSeconds;
}

/**
 * The inputs behind an estimate, so the UI can show its work
 * ("7 ahead ÷ 2 counters × ~2 min ≈ 7 min") instead of a black box.
 */
export interface WaitBreakdown {
  /** people ahead of the subject */
  ahead: number;
  /** open (active) counters serving this queue */
  counters: number;
  /** average service time used (seconds) */
  avgServiceSeconds: number;
  /** rounded result (seconds) */
  estimateSeconds: number;
}

function mean(values: number[], fallback: number): number {
  if (values.length === 0) return Math.round(fallback);
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Estimate for a specific waiting ticket (used on the ticket + staff list). */
export function estimateForTicket(
  state: QueueState,
  ticket: Ticket,
): WaitBreakdown {
  const meta = VENUES[ticket.venue];
  const aheadList = waitingTickets(state, ticket.venue).filter(
    (t) => t.joinedAt < ticket.joinedAt,
  );
  const counters = activeCounterCount(state, ticket.venue);
  const avg = mean(
    aheadList.map((t) => serviceSecondsFor(t, meta)),
    serviceSecondsFor(ticket, meta),
  );
  return {
    ahead: aheadList.length,
    counters,
    avgServiceSeconds: avg,
    estimateSeconds: Math.round((aheadList.length / counters) * avg),
  };
}

/** Estimate a new joiner would see, optionally for a chosen service type. */
export function estimateForNewJoiner(
  state: QueueState,
  meta: VenueMeta,
  serviceTypeId?: string,
): WaitBreakdown {
  const waiting = waitingTickets(state, meta.slug);
  const counters = activeCounterCount(state, meta.slug);
  const chosen = serviceTypeById(meta, serviceTypeId);
  const myService = chosen?.avgServiceSeconds ?? meta.avgServiceSeconds;
  const avg = mean(
    waiting.map((t) => serviceSecondsFor(t, meta)),
    myService,
  );
  return {
    ahead: waiting.length,
    counters,
    avgServiceSeconds: avg,
    estimateSeconds: Math.round((waiting.length / counters) * avg),
  };
}

/* ---------------- Busy indicator (live, from queue length) ---------------- */

export type BusyLevel = "quiet" | "moderate" | "busy";

export function busyLevel(meta: VenueMeta, waitingNow: number): BusyLevel {
  if (waitingNow >= meta.busyThresholds.busy) return "busy";
  if (waitingNow >= meta.busyThresholds.moderate) return "moderate";
  return "quiet";
}

export const BUSY_LABEL: Record<BusyLevel, string> = {
  quiet: "Quiet now",
  moderate: "Moderate",
  busy: "Busy now",
};

/* ---------------- "Come now vs later" (arrival-rate assumptions) ----------------
   For a future hour we reuse the SAME formula, substituting "people ahead"
   with an arrival rate (expected visitors per 10 minutes). Two clearly
   labelled sources feed the comparison:

     • "recent" — arrivals actually observed in this queue over the last hour
       (a small, honest signal while the demo runs), and
     • "demo"   — the venue's seeded per-hour arrival profile (sample data).

   Both are rough and explainable — and labelled as such in the UI.
   --------------------------------------------------------------------------- */

export interface RecentArrivalRate {
  /** minutes of history this was measured over */
  windowMinutes: number;
  /** tickets that joined in the window */
  count: number;
  /** observed arrivals per 10 minutes */
  per10Min: number;
  /** enough observations to be worth showing */
  reliable: boolean;
}

/**
 * Observed arrival rate from real ticket join times over the recent window.
 * This is live data (from the queue itself), not an assumption — but it is
 * noisy when few people have joined, so `reliable` flags small samples.
 */
export function recentArrivalRate(
  state: QueueState,
  meta: VenueMeta,
  now: number = Date.now(),
  windowMinutes = 60,
): RecentArrivalRate {
  const since = now - windowMinutes * 60_000;
  const count = state.tickets.filter(
    (t) => t.venue === meta.slug && t.joinedAt >= since,
  ).length;
  const per10Min = Math.round((count / windowMinutes) * 10 * 10) / 10;
  return { windowMinutes, count, per10Min, reliable: count >= 5 };
}

/** Demo arrival rate (visitors / 10 min) for a 24h hour, or null if untracked. */
export function arrivalRateAtHour(
  meta: VenueMeta,
  hour24: number,
): number | null {
  const idx = Math.floor(hour24) - meta.openHour;
  if (idx < 0 || idx >= meta.sampleArrivalRatePer10Min.length) return null;
  return meta.sampleArrivalRatePer10Min[idx];
}

export interface LaterEstimate {
  /** 24h hour this estimate is for */
  hour: number;
  /** demo expected arrivals per 10 minutes at this hour */
  arrivalsPer10Min: number;
  counters: number;
  avgServiceSeconds: number;
  estimateSeconds: number;
  /** arrivals are at/below the venue's quiet threshold */
  isQuiet: boolean;
}

/** Rough typical wait at a given hour, from demo arrival-rate data. */
export function typicalWaitAtHour(
  state: QueueState,
  meta: VenueMeta,
  hour24: number,
): LaterEstimate | null {
  const arrivals = arrivalRateAtHour(meta, hour24);
  if (arrivals === null) return null;
  const counters = activeCounterCount(state, meta.slug);
  const avg = meta.avgServiceSeconds;
  return {
    hour: hour24,
    arrivalsPer10Min: arrivals,
    counters,
    avgServiceSeconds: avg,
    estimateSeconds: Math.round((arrivals / counters) * avg),
    isQuiet: arrivals <= meta.quietArrivalThreshold,
  };
}

/** The least-busy remaining hour today (or null if the day is over). */
export function bestLaterSlot(
  state: QueueState,
  meta: VenueMeta,
  now: Date,
): LaterEstimate | null {
  const start = Math.max(meta.openHour, now.getHours() + 1);
  let best: LaterEstimate | null = null;
  for (let h = start; h < meta.closeHour; h++) {
    const candidate = typicalWaitAtHour(state, meta, h);
    if (candidate && (!best || candidate.arrivalsPer10Min < best.arrivalsPer10Min)) {
      best = candidate;
    }
  }
  return best;
}

/* ---------------- Staff stats ---------------- */

export function venueStats(state: QueueState, venue: VenueSlug) {
  const tickets = venueTickets(state, venue);
  const waiting = tickets.filter((t) => t.status === "waiting");
  const called = tickets.filter((t) => t.status === "called");
  const served = tickets.filter(
    (t) => t.status === "served" && t.servedAt && t.calledAt,
  );
  const noShows = tickets.filter((t) => t.status === "noshow");

  const avgWaitSeconds =
    served.length === 0
      ? null
      : Math.round(
          served.reduce((sum, t) => sum + (t.servedAt! - t.joinedAt), 0) /
            served.length /
            1000,
        );

  return {
    waitingCount: waiting.length,
    inServiceCount: called.length,
    servedCount: served.length,
    noShowCount: noShows.length,
    avgWaitSeconds,
  };
}
