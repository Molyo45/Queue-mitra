import { cn } from "@/lib/cn";

export interface TrackerStep {
  label: string;
  state: "done" | "current" | "todo";
}

/**
 * Horizontal progress tracker for a visitor's ticket journey:
 * Joined → In queue → Turn soon → At counter → Done
 */
export function ProgressTracker({ steps }: { steps: TrackerStep[] }) {
  return (
    <ol
      aria-label="Queue progress"
      className="flex items-start justify-between gap-1"
    >
      {steps.map((step, i) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
        >
          <div className="flex w-full items-center">
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-2 transition-colors",
                step.state === "done" && "bg-brand-600 ring-brand-200",
                step.state === "current" &&
                  "scale-125 bg-rose-500 ring-rose-200",
                step.state === "todo" && "bg-slate-200 ring-slate-100",
              )}
            />
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  step.state === "done" ? "bg-brand-600" : "bg-slate-200",
                )}
              />
            )}
          </div>
          <span
            className={cn(
              "text-[10px] leading-tight sm:text-[11px]",
              step.state === "current"
                ? "font-bold text-ink-900"
                : step.state === "done"
                  ? "font-medium text-ink-600"
                  : "text-ink-500",
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
