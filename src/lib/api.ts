"use client";

/**
 * Thin typed wrapper around the Queue Mitra HTTP API.
 *
 * All errors are normalised to `ApiError` so callers can show the server's
 * message directly (validation errors always carry a friendly `message`).
 */

import type { QueueState, Ticket, VenueSlug } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface CreateTicketResponse {
  ticket: Ticket;
  state: QueueState;
}

export interface StateResponse {
  state: QueueState;
}

export interface TicketActionResponse {
  state: QueueState;
  ticket?: Ticket;
}

export interface HealthResponse {
  ok: boolean;
  backend: string;
  realtime: string;
  node?: string;
  demoPinHint?: string;
  message?: string;
}

const STAFF_PIN_KEY = "queue-mitra-staff-pin";

export function getStaffPin(): string | null {
  try {
    return window.sessionStorage.getItem(STAFF_PIN_KEY);
  } catch {
    return null;
  }
}

export function setStaffPin(pin: string | null): void {
  try {
    if (pin) window.sessionStorage.setItem(STAFF_PIN_KEY, pin);
    else window.sessionStorage.removeItem(STAFF_PIN_KEY);
  } catch {
    /* storage blocked — staff actions will simply prompt again */
  }
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  options: { staff?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (options.staff) {
    const pin = getStaffPin();
    if (pin) headers.set("x-staff-pin", pin);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(
      0,
      "network",
      "Couldn't reach the Queue Mitra backend. Check your connection and try again.",
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON response (e.g. HTML error page) */
    }
  }

  if (!response.ok) {
    const body = data as
      | { error?: { code?: string; message?: string; field?: string } }
      | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? "error",
      body?.error?.message ?? `Request failed (${response.status}).`,
      body?.error?.field,
    );
  }

  return data as T;
}

export const api = {
  getState(): Promise<QueueState> {
    return request<QueueState>("/api/state", { method: "GET" });
  },

  health(): Promise<HealthResponse> {
    return request<HealthResponse>("/api/health", { method: "GET" });
  },

  createTicket(input: {
    venue: VenueSlug;
    name: string;
    serviceTypeId?: string;
    requestKey?: string;
  }): Promise<CreateTicketResponse> {
    return request<CreateTicketResponse>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  ticketAction(
    id: string,
    action: "cancel" | "serve" | "noshow" | "recall",
  ): Promise<TicketActionResponse> {
    return request<TicketActionResponse>(
      `/api/tickets/${encodeURIComponent(id)}`,
      { method: "POST", body: JSON.stringify({ action }) },
      { staff: action !== "cancel" },
    );
  },

  counterAction(
    id: string,
    action: "call" | "toggle",
  ): Promise<TicketActionResponse> {
    return request<TicketActionResponse>(
      `/api/counters/${encodeURIComponent(id)}`,
      { method: "POST", body: JSON.stringify({ action }) },
      { staff: true },
    );
  },

  venueAction(slug: VenueSlug, action: "pause"): Promise<StateResponse> {
    return request<StateResponse>(
      `/api/venues/${encodeURIComponent(slug)}`,
      { method: "POST", body: JSON.stringify({ action }) },
      { staff: true },
    );
  },

  demoAction(
    body: { action: "walkin"; venue: VenueSlug } | { action: "reset" },
  ): Promise<CreateTicketResponse | StateResponse> {
    return request<CreateTicketResponse | StateResponse>("/api/demo", {
      method: "POST",
      body: JSON.stringify(body),
    }, { staff: true });
  },

  staffLogin(pin: string): Promise<{ ok: true; demoPinHint?: string }> {
    return request<{ ok: true; demoPinHint?: string }>(
      "/api/staff/session",
      { method: "POST", body: JSON.stringify({ pin }) },
    );
  },
};
