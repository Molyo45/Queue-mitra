"use client";

/**
 * Local demo persistence engine — the **fallback** used when the backend is
 * unavailable.
 *
 * - The shared queue lives in `localStorage` so a page refresh keeps state.
 * - A `BroadcastChannel` mirrors state across tabs/windows, so a visitor tab and
 *   a staff tab on the same browser stay in sync even with no backend.
 *
 * This module only stores/broadcasts state. All domain actions live in
 * `store.ts` so that backend mode and demo mode share one implementation.
 */

import { DEMO_VERSION, seedState } from "./demo-data";
import type { QueueState } from "./types";

const STORAGE_KEY = "queue-mitra-state";
const CHANNEL_NAME = "queue-mitra-sync";

let state: QueueState = seedState();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let initialised = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full/blocked — demo still works in-memory */
  }
}

/** Hydrate from storage and join the cross-tab channel (idempotent). */
export function initLocal(): void {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueueState;
      if (parsed?.version === DEMO_VERSION) state = parsed;
    }
  } catch {
    /* corrupt storage — fall back to seed */
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<QueueState>) => {
      if (event.data?.version === DEMO_VERSION) {
        state = event.data;
        emit();
      }
    };
  } catch {
    /* BroadcastChannel unsupported — single tab still works */
  }
}

export function getLocalState(): QueueState {
  initLocal();
  return state;
}

/** Replace the whole state, persist it, and notify other tabs + subscribers. */
export function setLocalState(next: QueueState): void {
  state = next;
  persist();
  try {
    channel?.postMessage(next);
  } catch {
    /* channel closed — fine */
  }
  emit();
}

export function resetLocalState(): void {
  setLocalState(seedState());
}

export function subscribeLocal(listener: () => void): () => void {
  initLocal();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
