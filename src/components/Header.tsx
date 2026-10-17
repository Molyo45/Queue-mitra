import Link from "next/link";
import { cn } from "@/lib/cn";

const navLinkClass = cn(
  "rounded-full px-3 py-2 text-sm font-medium text-ink-600 transition-colors",
  "hover:bg-brand-50 hover:text-brand-700",
);

export function Header() {
  return (
    <header className="print-hide sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full py-1 pr-2 text-ink-900"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30"
          >
            {/* ticket mark */}
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M13 7v10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeDasharray="2 2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-base font-bold tracking-tight sm:text-lg">
            Queue Mitra
          </span>
          <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 sm:inline">
            Demo
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link href="/" className={navLinkClass} title="Home">
            Home
          </Link>
          <Link
            href="/scan"
            className={navLinkClass}
            title="Visitor entry — scan a venue QR (or simulate one)"
          >
            Scan&nbsp;QR
          </Link>
          <Link
            href="/staff/canteen"
            title="Staff entry — open the staff dashboard"
            className={cn(
              navLinkClass,
              "bg-ink-900 text-white hover:bg-ink-800 hover:text-white",
            )}
          >
            Staff&nbsp;demo
          </Link>
        </nav>
      </div>
    </header>
  );
}
