"use client";

import { useAsyncAction } from "@/lib/hooks";
import { actions } from "@/lib/store";
import type { VenueSlug } from "@/lib/types";

/**
 * Demo-only helpers. Everything here is clearly labelled as simulated so
 * judges (and users) always know what is real and what is seeded.
 *
 * Each control locks while in flight to avoid accidental repeated actions.
 * "Reset demo data" is a single click — it only ever restores the seeded demo
 * queue, so there is nothing to lose and no confirmation step to fumble
 * through during a live demo.
 */
export function SimulatePanel({ venue }: { venue: VenueSlug }) {
  const walkIn = useAsyncAction();
  const reset = useAsyncAction();

  return (
    <section
      aria-labelledby="simulate-heading"
      className="rounded-3xl border border-dashed border-amber-300 bg-amber-50/70 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="simulate-heading" className="text-sm font-bold text-amber-900">
          🎛 Demo controls
        </h3>
        <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
          Simulated data
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-900/80">
        Adds fake visitors to the queue so you can demo a rush without extra
        phones. These tickets are marked “sim”.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={walkIn.pending}
          onClick={() => void walkIn.run(() => actions.simulateWalkIn(venue))}
          className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-300 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {walkIn.pending ? "Adding…" : "+ Simulate walk-in"}
        </button>
        <button
          type="button"
          onClick={() => actions.simulateRush(venue, 4)}
          className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-300 transition-colors hover:bg-amber-100"
        >
          ⚡ Simulate rush (4)
        </button>
        <button
          type="button"
          disabled={reset.pending}
          aria-busy={reset.pending}
          onClick={() => void reset.run(() => actions.resetDemo())}
          title="Restore every venue to the seeded demo queue"
          className="inline-flex min-h-10 items-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reset.pending ? "Resetting…" : "↺ Reset demo data"}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-amber-900/70">
        One click restores <strong>every venue</strong> to the seeded demo queue
        (queue, counters and served history). Any open visitor tickets become
        invalid.
      </p>
    </section>
  );
}
