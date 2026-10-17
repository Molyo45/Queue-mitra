"use client";

import { cn } from "@/lib/cn";
import { useNow } from "@/lib/hooks";
import { formatHour } from "@/lib/format";
import type { VenueMeta } from "@/lib/venues";
import { SampleDataBadge } from "./ui";

/**
 * Demo arrival-rate chart: expected visitors per 10 minutes, per hour.
 * This is SAMPLE DATA (clearly labelled) and drives the "come now vs later"
 * comparison. Highlights the current hour.
 */
export function ArrivalRateChart({
  meta,
  className,
}: {
  meta: VenueMeta;
  className?: string;
}) {
  const now = useNow(60_000);
  const currentHour = new Date(now).getHours();
  const data = meta.sampleArrivalRatePer10Min;
  const max = Math.max(...data);

  const barColor = (arrivals: number) => {
    if (arrivals <= meta.quietArrivalThreshold) return "bg-emerald-400";
    if (arrivals >= max * 0.75) return "bg-rose-400";
    return "bg-amber-400";
  };

  const peakHour = meta.openHour + data.indexOf(max);
  const summary = `Demo arrival-rate data for ${meta.name}: about ${data[0]} visitors per 10 minutes at ${formatHour(
    meta.openHour,
  )}, peaking near ${data.indexOf(max)} per 10 minutes around ${formatHour(
    peakHour,
  )}. Sample data.`;

  return (
    <figure
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm font-semibold text-ink-900">
          When people usually arrive
        </figcaption>
        <SampleDataBadge />
      </div>

      <div
        role="img"
        aria-label={summary}
        className="mt-4 flex h-32 items-end gap-1.5"
      >
        {data.map((arrivals, i) => {
          const hour = meta.openHour + i;
          const isNow = hour === currentHour;
          return (
            <div
              key={hour}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <div
                className={cn(
                  "w-full rounded-t-md",
                  barColor(arrivals),
                  isNow && "ring-2 ring-ink-900/70 ring-offset-1",
                )}
                style={{ height: `${Math.max(8, (arrivals / max) * 100)}%` }}
              />
              <span
                className={cn(
                  "text-[9px] leading-none",
                  isNow ? "font-bold text-ink-900" : "text-ink-500",
                )}
              >
                {isNow ? "Now" : formatHour(hour).replace(":00", "")}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-500">
        Demo arrival-rate data — visitors per 10 minutes by hour. Live queue
        length above is real.
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
          Quiet
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />
          Getting busy
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-rose-400" />
          Peak
        </li>
      </ul>
    </figure>
  );
}
