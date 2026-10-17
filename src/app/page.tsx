import Link from "next/link";
import { VENUE_LIST } from "@/lib/venues";
import { ButtonLink } from "@/components/ui";
import { VenueCard } from "@/components/VenueCard";
import { WaitEstimateExplainer } from "@/components/WaitEstimateExplainer";

const STEPS = [
  {
    icon: "📷",
    title: "Scan the venue QR",
    body: "A printed poster at the counter opens the queue page in any phone browser — no app install.",
  },
  {
    icon: "🎟️",
    title: "Get a token & live wait",
    body: "See your number, how many people are ahead, and an estimated wait that updates by the second.",
  },
  {
    icon: "🔔",
    title: "Wait anywhere, then go",
    body: "Studying nearby? We nudge you when only a couple of people are left before your turn.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
            <span aria-hidden="true">🎓</span> DevSprint Hackathon · PS-2 ·
            Reducing Waiting Time in Everyday Queues
          </p>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-ink-900 sm:text-4xl">
            Skip the line.
            <br />
            <span className="text-brand-600">Keep your time.</span>
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-600">
            Queue Mitra is a QR-based virtual queue for campus venues. Students
            join from their phone, see a live wait estimate, and get reminded
            when their turn is close — while staff serve tickets from a simple
            dashboard. No cameras, no sensors, no expensive hardware.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/scan">▶ Try the demo (scan QR)</ButtonLink>
            <ButtonLink href="/staff/canteen" variant="secondary">
              Open staff dashboard
            </ButtonLink>
          </div>

          <p className="mt-4 text-xs text-ink-500">
            Live queue backend · SQLite persistence · realtime sync — seeded
            with clearly-labelled demo data
          </p>
        </div>

        {/* Phone-style preview (static mock) */}
        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/5">
            <div className="rounded-[1.5rem] bg-brand-50/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Your token · Canteen
              </p>
              <p className="mt-1 font-mono text-4xl font-black text-ink-900">
                C-041
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "Ahead", v: "5" },
                  { k: "Wait", v: "05:10" },
                  { k: "Turn", v: "1:42" },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl bg-white p-2">
                    <p className="text-[10px] text-ink-500">{s.k}</p>
                    <p className="text-lg font-black tabular-nums text-ink-900">
                      {s.v}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-white p-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-2/5 rounded-full bg-brand-600" />
                </div>
                <p className="mt-2 text-[11px] text-ink-500">
                  Reminder will buzz you at 2 people ahead
                </p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-500">
            Illustration — values are sample demo data
          </p>
        </div>
      </section>

      {/* ------------------------ Venue selection ------------------------ */}
      <section aria-labelledby="venues-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="venues-heading" className="text-xl font-bold text-ink-900">
              Try a demo venue
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Two venues are pre-loaded with realistic demo data. Pick an entry
              point below:
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
              <span>
                <span aria-hidden="true">🙋</span>{" "}
                <strong className="text-ink-900">Visitor</strong> → “Join the
                queue”
              </span>
              <span>
                <span aria-hidden="true">🧑‍💼</span>{" "}
                <strong className="text-ink-900">Staff</strong> → “Staff view”
              </span>
            </p>
          </div>
          <Link
            href="/scan"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Or simulate a QR scan →
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {VENUE_LIST.map((meta) => (
            <VenueCard key={meta.slug} meta={meta} />
          ))}
        </div>
      </section>

      {/* -------------------------- How it works -------------------------- */}
      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xl font-bold text-ink-900">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-xl"
                >
                  {step.icon}
                </span>
                <span className="text-xs font-bold text-brand-600">
                  STEP {i + 1}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink-900">
                {step.title}
              </h3>
              <p className="mt-1 text-sm text-ink-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------- Low-cost strip --------------------------- */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-ink-900">
          Why it stays low-cost
        </h2>
        <ul className="mt-4 grid gap-3 text-sm text-ink-600 sm:grid-cols-3">
          <li className="rounded-2xl bg-slate-50 p-4">
            <span aria-hidden="true" className="text-xl">
              🖨️
            </span>
            <p className="mt-2 font-semibold text-ink-900">
              Hardware = one poster
            </p>
            <p className="mt-1">
              The only physical item is a printed QR code at the counter.
            </p>
          </li>
          <li className="rounded-2xl bg-slate-50 p-4">
            <span aria-hidden="true" className="text-xl">
              📱
            </span>
            <p className="mt-2 font-semibold text-ink-900">Works in-browser</p>
            <p className="mt-1">
              No app store, no login, no student account needed to join.
            </p>
          </li>
          <li className="rounded-2xl bg-slate-50 p-4">
            <span aria-hidden="true" className="text-xl">
              📊
            </span>
            <p className="mt-2 font-semibold text-ink-900">
              Estimates, not sensors
            </p>
            <p className="mt-1">
              Waits are computed from queue position and average service time.
            </p>
          </li>
        </ul>
      </section>

      {/* --------------------- How the estimate works --------------------- */}
      <WaitEstimateExplainer />

      {/* ---------------------------- Disclosure ---------------------------- */}
      <section className="rounded-3xl border border-dashed border-amber-300 bg-amber-50/70 p-5 text-sm text-amber-900">
        <h2 className="font-bold">⚠ Demo &amp; simulated data disclosure</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            The queue is stored in a real backend (SQLite) and syncs live
            between devices. It is <strong>seeded with sample data</strong> —
            visitor names, initial tickets, and the arrival-rate history are
            simulated for the demo.
          </li>
          <li>
            Wait times are <strong>estimates</strong> from the number of people
            ahead, open counters and the average service time of each request
            type — not AI, and not a guarantee.
          </li>
          <li>
            “Come now vs later” compares the <strong>live queue</strong> with{" "}
            <strong>demo arrival-rate assumptions</strong> (and, once people
            join, the arrivals actually observed in the last hour).
          </li>
          <li>
            No payments or real SMS yet — reminders use in-app toasts and
            browser notifications. If the backend is offline, the app keeps
            working in local demo mode.
          </li>
        </ul>
      </section>
    </div>
  );
}
