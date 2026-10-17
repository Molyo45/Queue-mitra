"use client";

import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import type { QueueState } from "@/lib/types";
import type { VenueMeta } from "@/lib/venues";
import {
  busyLevel,
  BUSY_LABEL,
  estimateForNewJoiner,
  openCounterCount,
  waitingTickets,
} from "@/lib/wait";
import { Pill } from "./ui";

const LEVEL_PILL = {
  quiet: "quiet",
  moderate: "moderate",
  busy: "busy",
} as const;

/**
 * One-line live status for a venue: how many waiting, estimated wait for a
 * new joiner, busy level, and open/closed state.
 */
export function QueueStatusStrip({
  state,
  meta,
  className,
}: {
  state: QueueState;
  meta: VenueMeta;
  className?: string;
}) {
  const waiting = waitingTickets(state, meta.slug).length;
  const closed = state.closed[meta.slug];
  const openCounters = openCounterCount(state, meta.slug);
  const level = busyLevel(meta, waiting);
  const est = estimateForNewJoiner(state, meta);
  const noCounters = !closed && openCounters === 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm text-ink-600",
        className,
      )}
    >
      {closed ? (
        <Pill tone="closed">⏸ Queue paused</Pill>
      ) : noCounters ? (
        <Pill tone="closed">🔒 All counters closed</Pill>
      ) : (
        <Pill tone={LEVEL_PILL[level]}>
          <span aria-hidden="true">
            {level === "quiet" ? "🟢" : level === "moderate" ? "🟠" : "🔴"}
          </span>
          {BUSY_LABEL[level]}
        </Pill>
      )}
      <span>
        <strong className="text-ink-900">{waiting}</strong>{" "}
        {waiting === 1 ? "person" : "people"} waiting
      </span>
      {!closed && !noCounters && (
        <span className="text-ink-500" aria-hidden="true">
          ·
        </span>
      )}
      {!closed && !noCounters && (
        <span>
          {est.estimateSeconds === 0 ? (
            <>no wait if you join now</>
          ) : (
            <>
              ≈{" "}
              <strong className="text-ink-900">
                {formatDuration(est.estimateSeconds)}
              </strong>{" "}
              if you join now
            </>
          )}
        </span>
      )}
      {noCounters && (
        <span className="text-ink-500">
          waiting for a counter to reopen
        </span>
      )}
    </div>
  );
}
