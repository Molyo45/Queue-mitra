import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Generic pill / badge. Always pairs colour with text so colour is never
   the only signal (accessibility). */
export type PillTone =
  | "brand"
  | "quiet"
  | "moderate"
  | "busy"
  | "neutral"
  | "served"
  | "called"
  | "closed";

const PILL_TONES: Record<PillTone, string> = {
  brand: "bg-brand-100 text-brand-800 ring-brand-200",
  quiet: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  moderate: "bg-amber-100 text-amber-900 ring-amber-200",
  busy: "bg-rose-100 text-rose-800 ring-rose-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  served: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  called: "bg-brand-100 text-brand-800 ring-brand-200",
  closed: "bg-slate-200 text-slate-600 ring-slate-300",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "Sample data" badge — used wherever data is simulated/seeded. */
export function SampleDataBadge({ className }: { className?: string }) {
  return (
    <span
      title="Simulated data for the demo"
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
    >
      Sample data
    </span>
  );
}

/* --------------------------- state view blocks --------------------------- */

interface StateViewProps {
  icon: string;
  title: string;
  body: string;
  tone?: "neutral" | "success" | "error" | "brand";
  children?: ReactNode;
}

const STATE_TONES: Record<string, string> = {
  neutral: "bg-slate-50 border-slate-200",
  brand: "bg-brand-50 border-brand-200",
  success: "bg-emerald-50 border-emerald-200",
  error: "bg-rose-50 border-rose-200",
};

const STATE_ICON_TONES: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-100 text-brand-700",
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
};

function StateView({
  icon,
  title,
  body,
  tone = "neutral",
  children,
}: StateViewProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-3xl border p-6 text-center sm:p-8",
        STATE_TONES[tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl",
          STATE_ICON_TONES[tone],
        )}
      >
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">{body}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

export function EmptyState(props: Omit<StateViewProps, "tone">) {
  return <StateView {...props} tone="neutral" />;
}

export function SuccessState(props: Omit<StateViewProps, "tone">) {
  return <StateView {...props} tone="success" />;
}

export function ErrorState(props: Omit<StateViewProps, "tone">) {
  return <StateView {...props} tone="error" />;
}

/* Primary / secondary buttons, consistent everywhere */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const variants = {
    primary:
      "bg-brand-600 text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700",
    secondary:
      "bg-white text-ink-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
    ghost: "text-brand-700 hover:bg-brand-50",
  } as const;
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-colors",
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
