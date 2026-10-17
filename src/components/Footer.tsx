export function Footer() {
  return (
    <footer className="print-hide mt-10 border-t border-slate-200/70 bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs leading-relaxed text-ink-500 sm:px-6">
        <p>
          <span className="font-semibold text-ink-700">Queue Mitra</span> —
          built for DevSprint Hackathon (PS-2: Reducing Waiting Time in
          Everyday Queues).
        </p>
        <p className="mt-1">
          Queue data is stored server-side (SQLite) and synced live between the
          visitor and staff screens. The demo is seeded with clearly-labelled
          sample data and falls back to an in-browser local mode if the backend
          is unavailable. Wait times are simple estimates — not AI, and not a
          guarantee.
        </p>
      </div>
    </footer>
  );
}
