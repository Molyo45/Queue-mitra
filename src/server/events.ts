/**
 * In-process change bus used to push live queue updates to SSE clients.
 *
 * There is no external realtime service (no paid add-ons, no Redis): the
 * SQLite-backed API runs in the same Node process as the route handlers, so a
 * tiny event bus is all we need. The bus is stashed on `globalThis` so that
 * Next.js dev hot-reloads (which re-evaluate modules) don't create duplicate
 * buses and drop subscribers.
 */

type Listener = () => void;

interface Bus {
  listeners: Set<Listener>;
}

const globalRef = globalThis as unknown as { __queueMitraBus?: Bus };

const bus: Bus = (globalRef.__queueMitraBus ??= { listeners: new Set() });

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function onQueueChange(listener: Listener): () => void {
  bus.listeners.add(listener);
  return () => {
    bus.listeners.delete(listener);
  };
}

/** Notify every subscriber that the queue changed. */
export function emitQueueChange(): void {
  for (const listener of bus.listeners) {
    try {
      listener();
    } catch {
      /* a broken subscriber must not break the request */
    }
  }
}

/** Number of active subscribers (used by diagnostics/tests). */
export function subscriberCount(): number {
  return bus.listeners.size;
}
