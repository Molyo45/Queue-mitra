/**
 * Queue domain operations.
 *
 * Every mutation is validated, wrapped in a SQLite transaction, stamped with a
 * fresh `updated_at`, and then broadcast to SSE subscribers. Operations are
 * written to be **idempotent where it matters** (ticket creation via a request
 * key, cancelling an already-cancelled ticket) and to **reject accidental
 * repeats** with a helpful message (calling next on a busy counter, serving an
 * already-served ticket, …).
 */

import { randomUUID } from "node:crypto";

import { SIM_NAMES } from "@/lib/demo-data";
import type { QueueState, Ticket, VenueSlug } from "@/lib/types";
import { isVenueSlug, serviceTypeById, VENUES } from "@/lib/venues";

import {
  BackendUnavailableError,
  clearCounterForTicket,
  findIdempotentTicketId,
  firstWaitingTicketId,
  getCounterRow,
  getTicketRow,
  insertTicket,
  isVenuePaused,
  pruneClosedTickets,
  readState,
  rememberIdempotency,
  resetDatabase,
  setCounterActive,
  setCounterCurrent,
  setVenuePaused,
  takeNextSeq,
  touch,
  tx,
  updateTicket,
} from "./db";
import { emitQueueChange } from "./events";

/* --------------------------------- errors -------------------------------- */

/** A validation / business-rule error that maps to an HTTP status. */
export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export { BackendUnavailableError };

/* ------------------------------ input helpers ---------------------------- */

const MAX_NAME = 40;

function requireVenue(value: unknown): VenueSlug {
  if (typeof value !== "string" || !isVenueSlug(value)) {
    throw new DomainError(400, "unknown_venue", "That venue does not exist.", "venue");
  }
  return value;
}

function normalizeName(value: unknown): string {
  if (value === undefined || value === null) return "Guest";
  if (typeof value !== "string") {
    throw new DomainError(400, "invalid_name", "Name must be text.", "name");
  }
  // strip control characters, collapse whitespace
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return "Guest";
  if (cleaned.length > MAX_NAME) {
    throw new DomainError(400, "invalid_name", `Name is too long (max ${MAX_NAME} characters).`, "name");
  }
  return cleaned;
}

function normalizeServiceType(venue: VenueSlug, value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return VENUES[venue].serviceTypes[0]?.id;
  }
  if (typeof value !== "string") {
    throw new DomainError(400, "invalid_service_type", "Unknown request type.", "serviceTypeId");
  }
  if (!serviceTypeById(VENUES[venue], value)) {
    throw new DomainError(400, "invalid_service_type", "That request type isn't available for this venue.", "serviceTypeId");
  }
  return value;
}

function normalizeRequestKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  if (key.length === 0) return undefined;
  return key.slice(0, 120);
}

function requireTicket(id: unknown): Ticket {
  if (typeof id !== "string" || id.length === 0) {
    throw new DomainError(404, "ticket_not_found", "We couldn't find that ticket.");
  }
  const ticket = getTicketRow(id);
  if (!ticket) {
    throw new DomainError(404, "ticket_not_found", "We couldn't find that ticket.");
  }
  return ticket;
}

function requireCounter(id: unknown) {
  if (typeof id !== "string" || id.length === 0) {
    throw new DomainError(404, "counter_not_found", "We couldn't find that counter.");
  }
  const counter = getCounterRow(id);
  if (!counter) {
    throw new DomainError(404, "counter_not_found", "We couldn't find that counter.");
  }
  return counter;
}

function randomName(): string {
  return SIM_NAMES[Math.floor(Math.random() * SIM_NAMES.length)] ?? "Demo visitor";
}

function randomServiceType(venue: VenueSlug): string {
  const types = VENUES[venue].serviceTypes;
  const picked = types[Math.floor(Math.random() * types.length)];
  return picked?.id ?? types[0].id;
}

function commit(): QueueState {
  touch();
  emitQueueChange();
  return readState();
}

/* ------------------------------- operations ------------------------------ */

export interface CreateTicketInput {
  venue: unknown;
  name?: unknown;
  serviceTypeId?: unknown;
  requestKey?: unknown;
  isSimulated?: boolean;
  /** Only used by the demo simulator. */
  joinedAt?: number;
}

export function createTicket(input: CreateTicketInput): { ticket: Ticket; state: QueueState } {
  const venue = requireVenue(input.venue);
  const meta = VENUES[venue];

  return tx(() => {
    // Idempotency: a retried request returns the ticket it already created.
    const requestKey = normalizeRequestKey(input.requestKey);
    if (requestKey) {
      const existingId = findIdempotentTicketId(requestKey);
      if (existingId) {
        const existing = getTicketRow(existingId);
        if (existing) return { ticket: existing, state: readState() };
      }
    }

    if (!input.isSimulated && isVenuePaused(venue)) {
      throw new DomainError(
        409,
        "venue_paused",
        `${meta.shortName} has paused new tokens right now.`,
      );
    }

    const name = input.isSimulated ? normalizeName(input.name ?? randomName()) : normalizeName(input.name);
    const serviceTypeId = input.isSimulated
      ? normalizeServiceType(venue, input.serviceTypeId ?? randomServiceType(venue))
      : normalizeServiceType(venue, input.serviceTypeId);

    const seq = takeNextSeq(venue);
    const ticket: Ticket = {
      id: `${venue}-${seq}-${randomUUID().slice(0, 8)}`,
      venue,
      no: `${meta.prefix}-${String(seq).padStart(3, "0")}`,
      name,
      joinedAt: input.joinedAt ?? Date.now(),
      status: "waiting",
      serviceTypeId,
      isSimulated: input.isSimulated || undefined,
    };
    insertTicket(ticket);
    if (requestKey) rememberIdempotency(requestKey, ticket.id);
    pruneClosedTickets(venue);

    return { ticket, state: commit() };
  });
}

/** Visitor cancels their own ticket. Idempotent. */
export function cancelTicket(id: unknown): QueueState {
  return tx(() => {
    const ticket = requireTicket(id);
    if (ticket.status === "served") {
      throw new DomainError(409, "invalid_state", `Ticket ${ticket.no} has already been served.`);
    }
    if (ticket.status === "waiting" || ticket.status === "called") {
      updateTicket(ticket.id, { status: "skipped", counterId: null });
      clearCounterForTicket(ticket.id);
      return commit();
    }
    // already skipped / noshow — treat as success, nothing to change
    return readState();
  });
}

/** Staff: finish serving a ticket and free its counter. */
export function serveTicket(id: unknown): QueueState {
  return tx(() => {
    const ticket = requireTicket(id);
    if (ticket.status === "served") {
      throw new DomainError(409, "already_served", `Ticket ${ticket.no} is already marked served.`);
    }
    if (ticket.status !== "called" && ticket.status !== "waiting") {
      throw new DomainError(
        409,
        "invalid_state",
        `Ticket ${ticket.no} can't be marked served from its current state.`,
      );
    }
    updateTicket(ticket.id, { status: "served", servedAt: Date.now() });
    clearCounterForTicket(ticket.id);
    return commit();
  });
}

/** Staff: visitor didn't show up. */
export function noShowTicket(id: unknown): QueueState {
  return tx(() => {
    const ticket = requireTicket(id);
    if (ticket.status === "noshow") {
      throw new DomainError(409, "already_noshow", `Ticket ${ticket.no} is already marked as a no-show.`);
    }
    if (ticket.status !== "called" && ticket.status !== "waiting") {
      throw new DomainError(
        409,
        "invalid_state",
        `Ticket ${ticket.no} can't be marked as a no-show from its current state.`,
      );
    }
    updateTicket(ticket.id, { status: "noshow" });
    clearCounterForTicket(ticket.id);
    return commit();
  });
}

/** Staff: bring a skipped/no-show ticket back into the queue. */
export function recallTicket(id: unknown): QueueState {
  return tx(() => {
    const ticket = requireTicket(id);
    if (ticket.status === "waiting" || ticket.status === "called") {
      throw new DomainError(409, "already_waiting", `Ticket ${ticket.no} is already in the queue.`);
    }
    if (ticket.status === "served") {
      throw new DomainError(409, "invalid_state", `Ticket ${ticket.no} has already been served.`);
    }
    updateTicket(ticket.id, {
      status: "waiting",
      calledAt: null,
      counterId: null,
    });
    return commit();
  });
}

/** Staff: call the next waiting ticket to a specific counter. */
export function callNext(counterId: unknown): { ticket: Ticket; state: QueueState } {
  const counter = requireCounter(counterId);
  return tx(() => {
    if (!counter.active) {
      throw new DomainError(409, "counter_off", `${counter.label} is switched off. Activate it first.`);
    }
    if (counter.currentTicketId) {
      throw new DomainError(
        409,
        "counter_busy",
        `${counter.label} is already serving a ticket. Mark it served (or no-show) first.`,
      );
    }
    const ticketId = firstWaitingTicketId(counter.venue);
    if (!ticketId) {
      throw new DomainError(409, "queue_empty", "No one is waiting right now.");
    }
    updateTicket(ticketId, { status: "called", calledAt: Date.now(), counterId: counter.id });
    setCounterCurrent(counter.id, ticketId);
    const state = commit();
    const ticket = state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new DomainError(500, "internal_error", "Ticket disappeared while calling.");
    return { ticket, state };
  });
}

/** Staff: switch a counter on/off. Pausing a counter redistributes the load. */
export function toggleCounter(counterId: unknown): QueueState {
  const counter = requireCounter(counterId);
  return tx(() => {
    // Don't let a counter be switched off mid-service — that would leave a
    // "serving" ticket attached to a closed counter (an inconsistent state).
    if (counter.active && counter.currentTicketId) {
      throw new DomainError(
        409,
        "counter_busy",
        `${counter.label} is serving a ticket. Mark it served (or no-show) before switching it off.`,
      );
    }
    setCounterActive(counter.id, !counter.active);
    return commit();
  });
}

/** Staff: pause / resume accepting new tokens for a venue. */
export function setPaused(value: unknown, paused?: unknown): QueueState {
  const venue = requireVenue(value);
  return tx(() => {
    const next = typeof paused === "boolean" ? paused : !isVenuePaused(venue);
    setVenuePaused(venue, next);
    return commit();
  });
}

/** Demo helper: pretend a walk-in joined the queue. */
export function simulateWalkIn(value: unknown): { ticket: Ticket; state: QueueState } {
  const venue = requireVenue(value);
  return createTicket({
    venue,
    name: randomName(),
    serviceTypeId: randomServiceType(venue),
    isSimulated: true,
  });
}

/** Demo helper: restore the seeded demo data. */
export function resetDemo(): QueueState {
  resetDatabase();
  emitQueueChange();
  return readState();
}
