"use client";

import { ErrorState, ButtonLink } from "@/components/ui";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-6">
      <ErrorState
        icon="⚠️"
        title="Something went wrong"
        body="An unexpected error stopped this screen from rendering. Your demo data is still safe in the browser."
      >
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Try again
          </button>
          <ButtonLink href="/" variant="secondary">
            Go home
          </ButtonLink>
        </div>
      </ErrorState>
    </div>
  );
}
