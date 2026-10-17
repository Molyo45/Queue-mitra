/* Core types shared by the client app and the API route handlers. */

export type VenueSlug = "canteen" | "admin";

export type TicketStatus =
  | "waiting" // in the queue, hasn't been called
  | "called" // at a counter, being served
  | "served" // done
  | "skipped" // visitor left the queue themselves
  | "noshow"; // staff marked the visitor absent

export interface Ticket {
  id: string;
  venue: VenueSlug;
  /** Human-friendly ticket number, e.g. "C-037" */
  no: string;
  name: string;
  joinedAt: number; // epoch ms
  status: TicketStatus;
  calledAt?: number;
  servedAt?: number;
  counterId?: string;
  /** Optional chosen request type (see VenueMeta.serviceTypes). */
  serviceTypeId?: string;
  /** True when created by the demo simulator */
  isSimulated?: boolean;
}

export interface Counter {
  id: string;
  venue: VenueSlug;
  label: string; // "Counter 1"
  active: boolean;
  currentTicketId?: string;
}

export interface QueueState {
  /** Seed shape version — bumping it discards old saved state. */
  version: number;
  tickets: Ticket[];
  counters: Counter[];
  /** venue slug -> is the queue paused/closed for new tokens */
  closed: Record<VenueSlug, boolean>;
  /** next ticket number per venue */
  seq: Record<VenueSlug, number>;
  /**
   * epoch ms of the last server-side write. Only present in backend mode —
   * used by the client to detect fresh data and show "updated X ago".
   */
  updatedAt?: number;
}

/* ---------------------------- API / connection ---------------------------- */

/**
 * How the visitor/staff screens are kept up to date.
 *
 * - connecting : first load, deciding between backend and demo mode
 * - live       : backend reachable, streaming updates over SSE
 * - polling    : backend reachable, realtime unavailable, polling instead
 * - offline    : backend was reachable but is now unreachable
 * - local      : backend unavailable — running on the in-browser demo store
 */
export type BackendMode =
  | "connecting"
  | "live"
  | "polling"
  | "offline"
  | "local";

export interface ConnectionInfo {
  mode: BackendMode;
  /** How data is currently being refreshed. */
  transport: "sse" | "poll" | "local" | "none";
  /** epoch ms when the client last applied fresh data (0 = never). */
  lastRefreshedAt: number;
  /** Human-readable description of the last problem, if any. */
  lastError: string | null;
}

/** Shape of every error the API returns. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}
