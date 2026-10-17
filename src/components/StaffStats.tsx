import { formatDuration } from "@/lib/format";
import type { QueueState, VenueSlug } from "@/lib/types";
import { venueStats } from "@/lib/wait";

export function StaffStats({
  state,
  venue,
}: {
  state: QueueState;
  venue: VenueSlug;
}) {
  const stats = venueStats(state, venue);

  const tiles: Array<{ label: string; value: string; hint?: string; accent?: string }> = [
    { label: "Waiting", value: String(stats.waitingCount), accent: "text-brand-700" },
    { label: "Being served", value: String(stats.inServiceCount) },
    {
      label: "Served today",
      value: String(stats.servedCount),
      accent: "text-emerald-700",
    },
    {
      label: "Avg. wait",
      value: stats.avgWaitSeconds === null ? "—" : formatDuration(stats.avgWaitSeconds),
    },
    { label: "No-shows", value: String(stats.noShowCount), accent: "text-rose-700" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
        >
          <dt className="text-[11px] font-medium text-ink-500">{tile.label}</dt>
          <dd
            className={`mt-1 text-xl font-black tabular-nums sm:text-2xl ${tile.accent ?? "text-ink-900"}`}
          >
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
