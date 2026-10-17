"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  formatClock,
  formatCountdown,
  formatDuration,
  formatServiceTime,
} from "@/lib/format";
import { useNow, useAsyncAction } from "@/lib/hooks";
import { actions, useQueue } from "@/lib/store";
import { pushToast } from "@/lib/toast";
import type { Ticket } from "@/lib/types";
import { serviceTypeById, VENUES } from "@/lib/venues";
import { estimateForTicket, positionOf, ticketsAhead } from "@/lib/wait";
import { ProgressTracker, type TrackerStep } from "./ProgressTracker";
import { Pill } from "./ui";

/** People-ahead threshold at which we nudge the visitor to head over. */
const APPROACHING_AT = 2;

type PermissionState = "unsupported" | "default" | "granted" | "denied";

function readPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PermissionState;
}

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const state = useQueue();
  const now = useNow(1000);
  const meta = VENUES[ticket.venue];

  const ahead = ticketsAhead(state, ticket);
  const position = positionOf(state, ticket);
  const breakdown = estimateForTicket(state, ticket);
  const estWait = breakdown.estimateSeconds;
  const etaClock = formatClock(now + estWait * 1000);
  const counter = state.counters.find((c) => c.id === ticket.counterId);
  const serviceType = serviceTypeById(meta, ticket.serviceTypeId);

  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const leaveAction = useAsyncAction();
  const rejoinAction = useAsyncAction();
  const alertedRef = useRef(false);

  useEffect(() => setPermission(readPermission()), []);
  useEffect(() => {
    if (ahead > APPROACHING_AT) alertedRef.current = false;
  }, [ahead]);

  /* Turn-approaching reminder (fires once when we cross the threshold) */
  useEffect(() => {
    if (
      ticket.status === "waiting" &&
      ahead <= APPROACHING_AT &&
      ahead > 0 &&
      !alertedRef.current
    ) {
      alertedRef.current = true;
      pushToast({
        kind: "info",
        title: "Your turn is approaching",
        body: `Only ${ahead} ${ahead === 1 ? "person" : "people"} ahead of you.`,
      });
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Queue Mitra — your turn is approaching", {
            body: `Token ${ticket.no}: ${ahead} ahead of you. Head to ${meta.shortName}.`,
          });
        }
      }
    }
  }, [ahead, ticket.status, ticket.no, meta.shortName]);

  function enableAlerts() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    Notification.requestPermission().then((result) => {
      setPermission(result as PermissionState);
      pushToast(
        result === "granted"
          ? { kind: "success", title: "Turn alerts on", body: "We'll notify you as your turn nears." }
          : { kind: "error", title: "Notifications blocked", body: "Your browser blocked alerts. Check the site permissions." },
      );
    });
  }

  const isApproaching =
    ticket.status === "waiting" && ahead <= APPROACHING_AT && ahead >= 0;

  /* ------------------------------- tracker ------------------------------- */
  const steps: TrackerStep[] = (() => {
    const at = (i: number, currentIndex: number): TrackerStep["state"] =>
      i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";

    let current = 1; // 0 Joined
    if (ticket.status === "called") current = 3;
    else if (ticket.status === "served") current = 4;
    else if (isApproaching) current = 2;

    return [
      { label: "Joined", state: "done" },
      { label: "In queue", state: at(1, current) },
      { label: "Turn soon", state: at(2, current) },
      { label: "At counter", state: at(3, current) },
      { label: "Done", state: at(4, current) },
    ];
  })();

  /* ------------------------------ statuses ------------------------------ */

  const statusPill =
    ticket.status === "waiting" ? (
      <Pill tone="brand">In queue</Pill>
    ) : ticket.status === "called" ? (
      <Pill tone="called">Now serving</Pill>
    ) : ticket.status === "served" ? (
      <Pill tone="served">Served</Pill>
    ) : ticket.status === "noshow" ? (
      <Pill tone="busy">Missed</Pill>
    ) : (
      <Pill tone="neutral">Left queue</Pill>
    );

  return (
    <section
      aria-labelledby="ticket-heading"
      className={cn(
        "overflow-hidden rounded-3xl border bg-white shadow-sm",
        isApproaching && ticket.status === "waiting"
          ? "border-rose-200 ring-2 ring-rose-100"
          : "border-slate-200",
      )}
    >
      {/* Ticket stub header */}
      <div className="flex items-start justify-between gap-3 border-b border-dashed border-slate-200 bg-brand-50/60 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Your token · {meta.shortName}
          </p>
          <h2
            id="ticket-heading"
            className="mt-1 font-mono text-4xl font-black tracking-tight text-ink-900"
          >
            {ticket.no}
          </h2>
          <p className="mt-1 text-xs text-ink-600">
            {ticket.name} · joined {formatClock(ticket.joinedAt)}
          </p>
          {serviceType ? (
            <p className="mt-1 text-xs text-ink-600">
              <span aria-hidden="true">{serviceType.icon}</span>{" "}
              {serviceType.label}
            </p>
          ) : null}
        </div>
        {statusPill}
      </div>

      <div className="p-5">
        {/* Live region: status announcements for screen readers */}
        <p className="sr-only" role="status">
          {ticket.status === "waiting"
            ? `${ahead} people ahead of you. Estimated wait ${formatDuration(estWait)}.`
            : ticket.status === "called"
              ? `Your turn. Please go to ${counter?.label ?? "the counter"}.`
              : ticket.status === "served"
                ? "You have been served."
                : ""}
        </p>

        {/* -------------------------- WAITING -------------------------- */}
        {ticket.status === "waiting" && (
          <>
            {isApproaching && (
              <div className="mb-4 rounded-2xl bg-rose-50 p-4 ring-1 ring-inset ring-rose-200">
                <p className="text-sm font-bold text-rose-800">
                  🔔 Your turn is approaching
                </p>
                <p className="mt-0.5 text-xs text-rose-700">
                  Only {ahead} {ahead === 1 ? "person" : "people"} ahead — head
                  towards {meta.shortName} now.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
              <Stat label="People ahead" value={String(ahead)} />
              <Stat
                label="Est. wait left"
                value={formatCountdown(estWait)}
                hint="live estimate"
              />
              <Stat label="Your turn ≈" value={etaClock} />
            </div>

            <div className="mt-5">
              <ProgressTracker steps={steps} />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="text-xs text-ink-500">Your position</dt>
                <dd className="font-semibold text-ink-900">
                  #{position ?? "—"} in line
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="text-xs text-ink-500">Open counters</dt>
                <dd className="font-semibold text-ink-900">
                  {breakdown.counters}{" "}
                  {breakdown.counters === 1 ? "counter" : "counters"}
                </dd>
              </div>
            </dl>

            {/* Explainable estimate — show the work */}
            <details className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-inset ring-slate-200">
              <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                How is my wait estimated?
              </summary>
              <div className="mt-2 space-y-1.5 text-xs text-ink-600">
                <p className="font-mono text-ink-800">
                  {breakdown.ahead} ahead ÷ {breakdown.counters}{" "}
                  {breakdown.counters === 1 ? "counter" : "counters"} × ~
                  {formatServiceTime(breakdown.avgServiceSeconds)} avg ={" "}
                  {formatDuration(breakdown.estimateSeconds)}
                </p>
                <p>
                  The average service time comes from the people ahead of you
                  (each may have picked a different request type).
                </p>
                <p className="text-ink-500">
                  An estimate, not a promise — it assumes each person takes about
                  the average service time and all open counters are working. Real
                  queues vary; not AI and not a guarantee.
                </p>
              </div>
            </details>

            <AlertControls
              permission={permission}
              onEnable={enableAlerts}
            />

            {/* Leave queue — with an inline confirmation step */}
            <div className="mt-5">
              {confirmingLeave ? (
                <div
                  role="alertdialog"
                  aria-label="Confirm leaving the queue"
                  className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
                >
                  <p className="text-sm font-semibold text-rose-900">
                    Leave the queue?
                  </p>
                  <p className="mt-1 text-xs text-rose-800">
                    Your token {ticket.no} will be cancelled and you'll lose your
                    place (#{position ?? "—"}). You can join again later.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={leaveAction.pending}
                      onClick={() =>
                        void leaveAction.run(() => actions.leave(ticket.venue))
                      }
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {leaveAction.pending ? "Cancelling…" : "Yes, cancel my token"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingLeave(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
                    >
                      Keep waiting
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingLeave(true)}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
                >
                  Leave queue
                </button>
              )}
            </div>
          </>
        )}

        {/* -------------------------- CALLED -------------------------- */}
        {ticket.status === "called" && (
          <>
            <div className="animate-urgent rounded-2xl bg-rose-50 p-5 text-center ring-1 ring-inset ring-rose-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                Your turn now
              </p>
              <p className="mt-1 text-2xl font-black text-rose-800">
                Go to {counter?.label ?? "the counter"}
              </p>
              <p className="mt-1 text-xs text-rose-700">
                Called at {ticket.calledAt ? formatClock(ticket.calledAt) : "now"}
              </p>
            </div>

            <div className="mt-5">
              <ProgressTracker steps={steps} />
            </div>
          </>
        )}

        {/* -------------------------- SERVED -------------------------- */}
        {ticket.status === "served" && (
          <div className="text-center">
            <span aria-hidden="true" className="text-4xl">
              🎉
            </span>
            <p className="mt-2 text-lg font-bold text-ink-900">
              All done — thanks for waiting!
            </p>
            <p className="mt-1 text-sm text-ink-600">
              Served at {ticket.servedAt ? formatClock(ticket.servedAt) : "—"} ·
              actual wait{" "}
              {formatDuration(
                ((ticket.servedAt ?? now) - ticket.joinedAt) / 1000,
              )}
            </p>

            <div className="mt-5">
              <ProgressTracker steps={steps} />
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-ink-800">
                Was your estimated wait about right?
              </legend>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {["Shorter 🙂", "About right 👍", "Longer 😕"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={feedback === label}
                    onClick={() => {
                      setFeedback(label);
                      pushToast({
                        kind: "success",
                        title: "Thanks for the feedback!",
                        body: "This helps Queue Mitra estimate waits better.",
                      });
                    }}
                    className={cn(
                      "min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      feedback === label
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-ink-700 hover:bg-slate-200",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {feedback ? (
                <p className="mt-2 text-xs text-ink-500">
                  Feedback recorded (demo only).
                </p>
              ) : null}
            </fieldset>
          </div>
        )}

        {/* --------------------- LEFT / NO-SHOW --------------------- */}
        {(ticket.status === "skipped" || ticket.status === "noshow") && (
          <div
            role="alert"
            className={cn(
              "rounded-2xl p-5 text-center ring-1 ring-inset",
              ticket.status === "noshow"
                ? "bg-rose-50 ring-rose-200"
                : "bg-slate-50 ring-slate-200",
            )}
          >
            <span aria-hidden="true" className="text-3xl">
              {ticket.status === "noshow" ? "⏰" : "👋"}
            </span>
            <p className="mt-2 text-base font-bold text-ink-900">
              {ticket.status === "noshow"
                ? "You were marked as a no-show"
                : "You left the queue"}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              {ticket.status === "noshow"
                ? "Staff called your token but nobody was at the counter."
                : "Your token was cancelled. No worries — you can join again."}
            </p>
            <button
              type="button"
              disabled={rejoinAction.pending}
              onClick={() =>
                void rejoinAction.run(() =>
                  actions.join(ticket.venue, ticket.name, ticket.serviceTypeId),
                )
              }
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rejoinAction.pending ? "Rejoining…" : "Rejoin queue"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[11px] font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-ink-900">
        {value}
      </p>
      {hint ? <p className="text-[10px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

function AlertControls({
  permission,
  onEnable,
}: {
  permission: PermissionState;
  onEnable: () => void;
}) {
  if (permission === "granted") {
    return (
      <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
        ✓ Turn alerts are on — we'll remind you before your turn.
      </p>
    );
  }
  if (permission === "denied") {
    return (
      <p
        role="alert"
        className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200"
      >
        ⚠ Notifications are blocked in your browser. Keep this page open — the
        ticket still updates live.
      </p>
    );
  }
  if (permission === "unsupported") {
    return (
      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-ink-600 ring-1 ring-inset ring-slate-200">
        ℹ This browser doesn't support notifications. Keep this page open —
        the ticket still updates live.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onEnable}
      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-100"
    >
      🔔 Remind me when my turn is near
    </button>
  );
}
