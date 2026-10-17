/* Small formatting helpers */

/** "12 min" / "45 sec" / "1 h 05 min" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} sec`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/** A service time like "2 min" or "2.5 min" (keeps the half-minute visible). */
export function formatServiceTime(seconds: number): string {
  const m = seconds / 60;
  return Number.isInteger(m) ? `${m} min` : `${m.toFixed(1)} min`;
}

/** "04:59" style countdown */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** "12:41 PM" */
export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "6 min ago" / "just now" */
export function formatAgo(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ago`;
}

/** "11:00 PM" from a decimal-ish hour like 13.5 */
export function formatHour(hour24: number): string {
  const h = Math.floor(hour24);
  const m = Math.round((hour24 - h) * 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h12} ${suffix}`
    : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
