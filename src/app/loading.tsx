export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-28 animate-pulse rounded-3xl bg-slate-200/60" />
      <div className="h-48 animate-pulse rounded-3xl bg-slate-200/60" />
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />
    </div>
  );
}
