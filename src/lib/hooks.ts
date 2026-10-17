"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * True once the component has mounted in the browser.
 *
 * Our pages read live local state (which differs between server render and
 * client render), so we render a light skeleton until mounted to avoid
 * hydration mismatches. This doubles as our loading state.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/**
 * A ticking `now` for live countdowns. Re-renders on an interval.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Guards a staff action against double submission.
 *
 * `pending` disables the button while the request is in flight, and a ref
 * blocks a second click that lands before React re-renders — so a rapid
 * double-tap can't call the backend twice.
 */
export function useAsyncAction(): {
  pending: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
} {
  const [pending, setPending] = useState(false);
  const locked = useRef(false);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    try {
      await fn();
    } finally {
      locked.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}
