import { cn } from "@/lib/cn";

/**
 * Short, always-visible explanation of how a wait estimate is produced.
 *
 * Deliberately plain arithmetic (no AI, no black box) so a judge or a first-time
 * visitor can understand the number in a few seconds.
 */
export function WaitEstimateExplainer({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="wait-estimate-explainer"
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-5",
        className,
      )}
    >
      <h2
        id="wait-estimate-explainer"
        className="text-base font-bold text-ink-900"
      >
        How we estimate your wait
      </h2>

      <p className="mt-3 overflow-x-auto rounded-2xl bg-slate-50 px-4 py-3 font-mono text-xs text-ink-700 ring-1 ring-inset ring-slate-200">
        estimated wait = (people ahead ÷ open counters) × average service time
      </p>

      <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
        <li>
          <strong className="text-ink-900">People ahead</strong> — how many
          waiting tickets joined the line before yours.
        </li>
        <li>
          <strong className="text-ink-900">Open counters</strong> — the counters
          staff currently have switched on for this venue.
        </li>
        <li>
          <strong className="text-ink-900">Average service time</strong> — the
          mean of the request types in the queue; each request shows its typical
          time when you join.
        </li>
      </ul>

      <p className="mt-3 text-xs text-ink-500">
        The number recalculates automatically whenever someone joins, leaves, is
        served, or a counter is paused or resumed. It is a rough estimate — a
        guide, not a guarantee — and it is <strong>not</strong> AI.
      </p>
    </section>
  );
}
