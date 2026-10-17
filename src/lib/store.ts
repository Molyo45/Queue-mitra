"use client";

/**
 * Queue store facade.
 *
 * The whole UI talks to this module through `useQueue()`, `useConnection()` and
 * `actions`. Under the hood it runs in one of two modes:
 *
 *  • **Backend mode** — state comes from the SQLite-backed API. Updates are
 *    pushed live over Server-Sent Events (`/api/state/stream`); if realtime is
 *    unavailable the client transparently falls back to polling `/api/state`
 *    and shows when the data was last refreshed.
 *
 *  • **Local demo mode** — if the backend can't be reached, everything keeps
 *    working from the in-browser store (`local-store.ts`) with cross-tab sync.
 *
 * Either way the domain actions (join, leave, call next, serve, …) share one
 * implementation so the visitor and staff screens behave identically.
 */

import { useSyncExternalStore } from "react";

import { ApiError, api, setStaffPin } from "./api";
import { seedState, SIM_NAMES } from "./demo-data";
import * as local from "./local-store";
import { pushToast } from "./toast";
import type {
  ConnectionInfo,
  Counter,
  QueueState,
  Ticket,
  VenueSlug,
} from "./types";
import { VENUES } from "./venues";
import { waitingTickets } from "./wait";

const MY_TICKET_KEY = "queue-mitra-my-ticket";
const POLL_FALLBACK_MS = 2000;
/** Safety-net re-sync while live, so a missed SSE frame self-heals. */
const RECONCILE_MS = 15000;

const configuredPoll = Number(process.env.NEXT_PUBLIC_POLL_MS);
const POLL_MS =
  Number.isFinite(configuredPoll) && configuredPoll >= 500
    ? configuredPoll
    : POLL_FALLBACK_MS;

/** PIN used only when the backend is unavailable (demo fallback). */
const LOCAL_DEMO_PIN = "1234";

/** True for the client-only static build (GitHub Pages): no backend at all. */
const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

/* -------------------------------- module state -------------------------------- */

let state: QueueState = seedState();
let connection: ConnectionInfo = {
  mode: "connecting",
  transport: "none",
  lastRefreshedAt: 0,
  lastError: null,
};
const listeners = new Set<() => void>();

/** Whether we are currently using the backend or the in-browser demo store. */
let backend: "remote" | "local" = "local";
let started = false;
let eventSource: EventSource | null = null;
let pollTimer: number | null = null;
let streamRetryTimer: number | null = null;
let reconcileTimer: number | null = null;

type Listener = () => void;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setConnection(patch: Partial<ConnectionInfo>): void {
  connection = { ...connection, ...patch };
  emit();
}

function applyRemote(next: QueueState): void {
  state = next;
  connection = { ...connection, lastRefreshedAt: Date.now(), lastError: null };
  emit();
}

function errorText(error: unknown): string | null {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return null;
}

/* ------------------------------ realtime / polling ------------------------------ */

function closeStream(): void {
  if (!eventSource) return;
  eventSource.onopen = null;
  eventSource.onmessage = null;
  eventSource.onerror = null;
  eventSource.close();
  eventSource = null;
}

function stopPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startReconcile(): void {
  if (typeof window === "undefined" || reconcileTimer !== null) return;
  reconcileTimer = window.setInterval(() => {
    if (backend === "remote" && document.visibilityState === "visible") {
      void pollOnce("reconcile");
    }
  }, RECONCILE_MS);
}

function stopReconcile(): void {
  if (reconcileTimer !== null) {
    window.clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
}

function openStream(): void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    startPolling();
    return;
  }
  closeStream();
  try {
    const source = new EventSource("/api/state/stream");
    eventSource = source;

    source.onopen = () => {
      // Realtime is back — stop the polling fallback.
      stopPolling();
      setConnection({ mode: "live", transport: "sse", lastError: null });
    };
    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as QueueState;
        stopPolling();
        applyRemote(next);
        setConnection({ mode: "live", transport: "sse", lastError: null });
      } catch {
        /* ignore malformed frame */
      }
    };
    source.onerror = () => {
      // Realtime isn't available here — degrade to polling and try SSE later.
      closeStream();
      if (backend !== "remote") return;
      setConnection({
        mode: "polling",
        transport: "poll",
        lastError: "Live updates unavailable — refreshing every couple of seconds.",
      });
      startPolling();
      scheduleStreamRetry();
    };
  } catch {
    startPolling();
  }
}

function scheduleStreamRetry(): void {
  if (typeof window === "undefined" || streamRetryTimer !== null) return;
  streamRetryTimer = window.setTimeout(() => {
    streamRetryTimer = null;
    if (backend === "remote" && !eventSource) openStream();
  }, 30_000);
}

async function pollOnce(source: "poll" | "reconcile" = "poll"): Promise<void> {
  try {
    const next = await api.getState();
    backend = "remote";
    applyRemote(next);
    setConnection({
      mode: connection.transport === "sse" ? "live" : "polling",
    });
  } catch (error) {
    if (backend === "local") {
      stopPolling();
      return;
    }
    // A single failed safety-net re-sync while SSE is healthy isn't an outage.
    if (source === "reconcile" && eventSource) return;
    setConnection({ mode: "offline", lastError: errorText(error) });
  }
}

function startPolling(): void {
  if (typeof window === "undefined" || pollTimer !== null) return;
  pollTimer = window.setInterval(() => void pollOnce("poll"), POLL_MS);
  void pollOnce("poll");
}

async function connect(): Promise<void> {
  // The static (GitHub Pages) build ships without API routes — start in demo mode.
  if (IS_STATIC_EXPORT) {
    enterLocalMode();
    return;
  }
  setConnection({ mode: "connecting", lastError: null });
  try {
    const next = await api.getState();
    backend = "remote";
    applyRemote(next);
    openStream();
    startReconcile();
  } catch (error) {
    enterLocalMode(error);
  }
}

function enterLocalMode(error?: unknown): void {
  closeStream();
  stopPolling();
  stopReconcile();
  if (streamRetryTimer !== null) {
    window.clearTimeout(streamRetryTimer);
    streamRetryTimer = null;
  }
  backend = "local";
  local.initLocal();
  state = local.getLocalState();
  connection = {
    ...connection,
    mode: "local",
    transport: "local",
    lastRefreshedAt: Date.now(),
    lastError: errorText(error),
  };
  emit();
}

async function refreshNow(): Promise<void> {
  if (backend === "local") {
    state = local.getLocalState();
    emit();
    return;
  }
  await pollOnce("reconcile");
}

/* -------------------------------- lifecycle -------------------------------- */

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  // Mirror in-browser state across tabs while in demo mode.
  local.subscribeLocal(() => {
    if (backend === "local") {
      state = local.getLocalState();
      emit();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refreshNow();
  });
  window.addEventListener("focus", () => void refreshNow());

  void connect();
}

function subscribe(listener: Listener): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): QueueState {
  return state;
}

function getConnectionSnapshot(): ConnectionInfo {
  return connection;
}

/* --------------------------------- hooks --------------------------------- */

export function useQueue(): QueueState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useConnection(): ConnectionInfo {
  return useSyncExternalStore(subscribe, getConnectionSnapshot, getConnectionSnapshot);
}

/* --------------------------- "my ticket" (per tab) --------------------------- */

export function getMyTicketId(venue: VenueSlug): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(`${MY_TICKET_KEY}:${venue}`);
  } catch {
    return null;
  }
}

function setMyTicketId(venue: VenueSlug, id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.sessionStorage.setItem(`${MY_TICKET_KEY}:${venue}`, id);
    else window.sessionStorage.removeItem(`${MY_TICKET_KEY}:${venue}`);
  } catch {
    /* ignore */
  }
}

export function myTicket(venue: VenueSlug): Ticket | null {
  const id = getMyTicketId(venue);
  if (!id) return null;
  return state.tickets.find((t) => t.id === id) ?? null;
}

/* -------------------------------- helpers -------------------------------- */

function newRequestKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function localBase(): QueueState {
  local.initLocal();
  return local.getLocalState();
}

function toastsForJoin(venue: VenueSlug, ticket: Ticket): void {
  const type = VENUES[venue].serviceTypes.find((s) => s.id === ticket.serviceTypeId);
  pushToast({
    kind: "success",
    title: `Token ${ticket.no} added`,
    body: type
      ? `${type.label} · we'll tell you when your turn is close.`
      : "We'll tell you when your turn gets close.",
  });
}

/* -------------------------------- actions -------------------------------- */

export const actions = {
  /** Visitor joins a queue. Returns the new ticket, or null if not allowed. */
  async join(
    venue: VenueSlug,
    name: string,
    serviceTypeId?: string,
    options: { requestKey?: string } = {},
  ): Promise<Ticket | null> {
    const meta = VENUES[venue];
    const cleanName = name.replace(/\s+/g, " ").trim().slice(0, 40) || "Guest";

    if (backend === "remote") {
      try {
        const result = await api.createTicket({
          venue,
          name: cleanName,
          serviceTypeId,
          requestKey: options.requestKey ?? newRequestKey(),
        });
        applyRemote(result.state);
        setMyTicketId(venue, result.ticket.id);
        toastsForJoin(venue, result.ticket);
        return result.ticket;
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't join the queue",
          body: errorText(error) ?? "Please try again.",
        });
        return null;
      }
    }

    const base = localBase();
    if (base.closed[venue]) {
      pushToast({
        kind: "error",
        title: "Queue is paused",
        body: `${meta.shortName} has paused new tokens right now.`,
      });
      return null;
    }
    const seq = base.seq[venue];
    const ticket: Ticket = {
      id: `${venue}-${seq}-${newRequestKey().slice(0, 8)}`,
      venue,
      no: `${meta.prefix}-${String(seq).padStart(3, "0")}`,
      name: cleanName,
      joinedAt: Date.now(),
      status: "waiting",
      serviceTypeId: serviceTypeId ?? meta.serviceTypes[0]?.id,
    };
    local.setLocalState({
      ...base,
      tickets: [...base.tickets, ticket],
      seq: { ...base.seq, [venue]: seq + 1 },
      updatedAt: Date.now(),
    });
    setMyTicketId(venue, ticket.id);
    toastsForJoin(venue, ticket);
    return ticket;
  },

  /** Visitor cancels their own ticket. */
  async leave(venue: VenueSlug): Promise<void> {
    const id = getMyTicketId(venue);
    if (!id) return;

    if (backend === "remote") {
      try {
        const result = await api.ticketAction(id, "cancel");
        applyRemote(result.state);
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't leave the queue",
          body: errorText(error) ?? "Please try again.",
        });
        return;
      }
    } else {
      const base = localBase();
      local.setLocalState({
        ...base,
        tickets: base.tickets.map((t) =>
          t.id === id ? { ...t, status: "skipped" } : t,
        ),
        updatedAt: Date.now(),
      });
    }
    setMyTicketId(venue, null);
    pushToast({ kind: "info", title: "You left the queue", body: "You can rejoin any time." });
  },

  /** Staff: call the next waiting ticket to a specific counter. */
  async callNext(venue: VenueSlug, counterId: string): Promise<Ticket | null> {
    if (backend === "remote") {
      try {
        const result = await api.counterAction(counterId, "call");
        applyRemote(result.state);
        const ticket = result.ticket ?? null;
        if (ticket) {
          const label =
            result.state.counters.find((c) => c.id === counterId)?.label ?? "the counter";
          pushToast({ kind: "info", title: `Called ${ticket.no}`, body: `${ticket.name} → ${label}` });
        }
        return ticket;
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't call the next ticket",
          body: errorText(error) ?? "Please try again.",
        });
        return null;
      }
    }

    const base = localBase();
    const counter = base.counters.find((c) => c.id === counterId);
    if (!counter) return null;
    if (!counter.active) {
      pushToast({ kind: "error", title: `${counter.label} is switched off`, body: "Activate it first." });
      return null;
    }
    if (counter.currentTicketId) {
      pushToast({
        kind: "error",
        title: `${counter.label} is busy`,
        body: "Mark the current ticket as served (or no-show) first.",
      });
      return null;
    }
    const next = waitingTickets(base, venue)[0];
    if (!next) {
      pushToast({ kind: "info", title: "Queue is empty", body: "No one is waiting right now." });
      return null;
    }
    local.setLocalState({
      ...base,
      tickets: base.tickets.map((t) =>
        t.id === next.id
          ? { ...t, status: "called", calledAt: Date.now(), counterId }
          : t,
      ),
      counters: base.counters.map((c) =>
        c.id === counterId ? { ...c, currentTicketId: next.id } : c,
      ),
      updatedAt: Date.now(),
    });
    pushToast({ kind: "info", title: `Called ${next.no}`, body: `${next.name} → ${counter.label}` });
    return next;
  },

  /** Staff: finish serving a ticket and free its counter. */
  async markServed(ticketId: string): Promise<void> {
    if (backend === "remote") {
      try {
        const result = await api.ticketAction(ticketId, "serve");
        applyRemote(result.state);
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't mark served",
          body: errorText(error) ?? "Please try again.",
        });
      }
      return;
    }
    const base = localBase();
    local.setLocalState({
      ...base,
      tickets: base.tickets.map((t) =>
        t.id === ticketId ? { ...t, status: "served", servedAt: Date.now() } : t,
      ),
      counters: base.counters.map((c) =>
        c.currentTicketId === ticketId ? { ...c, currentTicketId: undefined } : c,
      ),
      updatedAt: Date.now(),
    });
  },

  /** Staff: visitor didn't show up. */
  async markNoShow(ticketId: string): Promise<void> {
    if (backend === "remote") {
      try {
        const result = await api.ticketAction(ticketId, "noshow");
        applyRemote(result.state);
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't mark no-show",
          body: errorText(error) ?? "Please try again.",
        });
      }
      return;
    }
    const base = localBase();
    local.setLocalState({
      ...base,
      tickets: base.tickets.map((t) =>
        t.id === ticketId ? { ...t, status: "noshow" } : t,
      ),
      counters: base.counters.map((c) =>
        c.currentTicketId === ticketId ? { ...c, currentTicketId: undefined } : c,
      ),
      updatedAt: Date.now(),
    });
  },

  /** Staff: bring a skipped/no-show ticket back into the queue. */
  async recall(ticketId: string): Promise<void> {
    if (backend === "remote") {
      try {
        const result = await api.ticketAction(ticketId, "recall");
        applyRemote(result.state);
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't recall the ticket",
          body: errorText(error) ?? "Please try again.",
        });
      }
      return;
    }
    const base = localBase();
    local.setLocalState({
      ...base,
      tickets: base.tickets.map((t) =>
        t.id === ticketId
          ? { ...t, status: "waiting", calledAt: undefined, counterId: undefined }
          : t,
      ),
      updatedAt: Date.now(),
    });
  },

  /** Staff: switch a counter on/off. */
  async toggleCounter(counterId: string): Promise<void> {
    const counter = state.counters.find((c) => c.id === counterId);
    if (counter?.active && counter.currentTicketId) {
      pushToast({
        kind: "info",
        title: `${counter.label} is serving a ticket`,
        body: "Mark it served or no-show before switching this counter off.",
      });
      return;
    }
    if (backend === "remote") {
      try {
        const result = await api.counterAction(counterId, "toggle");
        applyRemote(result.state);
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't update the counter",
          body: errorText(error) ?? "Please try again.",
        });
      }
      return;
    }
    const base = localBase();
    local.setLocalState({
      ...base,
      counters: base.counters.map((c) =>
        c.id === counterId ? { ...c, active: !c.active } : c,
      ),
      updatedAt: Date.now(),
    });
  },

  /** Staff: pause / resume accepting new tokens. */
  async toggleClosed(venue: VenueSlug): Promise<void> {
    const willClose = !state.closed[venue];
    if (backend === "remote") {
      try {
        const result = await api.venueAction(venue, "pause");
        applyRemote(result.state);
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't change the queue status",
          body: errorText(error) ?? "Please try again.",
        });
        return;
      }
    } else {
      const base = localBase();
      const nowClosed = !base.closed[venue];
      local.setLocalState({
        ...base,
        closed: { ...base.closed, [venue]: nowClosed },
        updatedAt: Date.now(),
      });
      pushToast({
        kind: nowClosed ? "info" : "success",
        title: nowClosed ? "Queue paused" : "Queue reopened",
        body: nowClosed ? "Visitors can no longer join." : "Visitors can join again.",
      });
      return;
    }
    pushToast({
      kind: willClose ? "info" : "success",
      title: willClose ? "Queue paused" : "Queue reopened",
      body: willClose ? "Visitors can no longer join." : "Visitors can join again.",
    });
  },

  /** Demo helper: pretend a walk-in joined the queue. */
  async simulateWalkIn(venue: VenueSlug, silent = false): Promise<void> {
    if (backend === "remote") {
      try {
        const result = await api.demoAction({ action: "walkin", venue });
        if ("state" in result) applyRemote(result.state);
        if (!silent && "ticket" in result) {
          pushToast({
            kind: "info",
            title: "Simulated visitor joined",
            body: `${result.ticket.no} · ${result.ticket.name} (demo data)`,
          });
        }
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't add a simulated visitor",
          body: errorText(error) ?? "Please try again.",
        });
      }
      return;
    }
    const base = localBase();
    const name = SIM_NAMES[Math.floor(Math.random() * SIM_NAMES.length)] ?? "Demo visitor";
    const types = VENUES[venue].serviceTypes;
    const serviceTypeId = types[Math.floor(Math.random() * types.length)]?.id;
    const seq = base.seq[venue];
    const ticket: Ticket = {
      id: `${venue}-${seq}-${newRequestKey().slice(0, 8)}`,
      venue,
      no: `${VENUES[venue].prefix}-${String(seq).padStart(3, "0")}`,
      name,
      joinedAt: Date.now(),
      status: "waiting",
      serviceTypeId,
      isSimulated: true,
    };
    local.setLocalState({
      ...base,
      tickets: [...base.tickets, ticket],
      seq: { ...base.seq, [venue]: seq + 1 },
      updatedAt: Date.now(),
    });
    if (!silent) {
      pushToast({
        kind: "info",
        title: "Simulated visitor joined",
        body: `${ticket.no} · ${name} (demo data)`,
      });
    }
  },

  /** Demo helper: a small rush of walk-ins, staggered a few seconds apart. */
  simulateRush(venue: VenueSlug, count = 4): void {
    if (typeof window === "undefined") return;
    pushToast({
      kind: "info",
      title: `Simulating ${count} walk-ins…`,
      body: "Watch the queue fill up (simulated visitors).",
    });
    for (let i = 0; i < count; i++) {
      window.setTimeout(() => void actions.simulateWalkIn(venue, true), i * 1500);
    }
  },

  /** Demo helper: restore the seeded demo data. */
  async resetDemo(): Promise<void> {
    if (backend === "remote") {
      try {
        const result = await api.demoAction({ action: "reset" });
        if ("state" in result) applyRemote(result.state);
      } catch (error) {
        pushToast({
          kind: "error",
          title: "Couldn't reset the demo data",
          body: errorText(error) ?? "Please try again.",
        });
        return;
      }
    } else {
      local.resetLocalState();
    }
    clearMyTickets();
    pushToast({ kind: "success", title: "Demo data restored" });
  },

  /** Verify a staff PIN (backend) or the demo PIN (local mode). */
  async staffLogin(
    pin: string,
  ): Promise<{ ok: boolean; error?: string; demoPinHint?: string }> {
    if (backend === "remote") {
      try {
        const result = await api.staffLogin(pin);
        setStaffPin(pin);
        return { ok: true, demoPinHint: result.demoPinHint };
      } catch (error) {
        return { ok: false, error: errorText(error) ?? "Incorrect PIN." };
      }
    }
    if (pin === LOCAL_DEMO_PIN) {
      setStaffPin(pin);
      return { ok: true, demoPinHint: LOCAL_DEMO_PIN };
    }
    return { ok: false, error: "Incorrect PIN." };
  },

  /**
   * The demo PIN to display as a hint, if the deployment is still using the
   * built-in demo authentication. Returns null for a custom PIN.
   */
  async demoPinHint(): Promise<string | null> {
    if (backend === "local") return LOCAL_DEMO_PIN;
    try {
      const health = await api.health();
      return health.demoPinHint ?? null;
    } catch {
      return null;
    }
  },

  /** Force a manual refresh (used by the connection status bar). */
  async refresh(): Promise<void> {
    await refreshNow();
  },

  /** Retry connecting to the backend after a failure. */
  async retry(): Promise<void> {
    if (backend === "local") {
      await connect();
    } else {
      await refreshNow();
      if (backend === "remote" && !eventSource) openStream();
    }
  },

  /** Explicitly switch to the in-browser demo store. */
  useLocalMode(error?: string): void {
    enterLocalMode(error ? new Error(error) : undefined);
    pushToast({
      kind: "info",
      title: "Local demo mode",
      body: "Data is now stored in this browser only.",
    });
  },
};

function clearMyTickets(): void {
  if (typeof window === "undefined") return;
  for (const venue of Object.keys(VENUES) as VenueSlug[]) {
    setMyTicketId(venue, null);
  }
}

export type { Counter };
