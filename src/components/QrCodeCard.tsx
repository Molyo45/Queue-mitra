"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import type { VenueMeta } from "@/lib/venues";

/**
 * A printable QR poster for a venue. The QR encodes the venue's visitor
 * URL — in the real deployment this is what people scan at the counter.
 * (Here it encodes the local dev URL, so scanning it with a phone on the
 * same network actually opens the queue page.)
 */
export function QrCodeCard({ meta }: { meta: VenueMeta }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Include the GitHub Pages base path (empty for local / custom domains).
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const url = `${origin}${basePath}/q/${meta.slug}/`;

  return (
    <article className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <span aria-hidden="true" className="text-3xl">
        {meta.icon}
      </span>
      <h2 className="mt-2 text-lg font-bold text-ink-900">{meta.name}</h2>
      <p className="mt-0.5 text-xs text-ink-500">{meta.hours}</p>

      <div
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-3"
        aria-label={`QR code linking to ${url || "the venue queue page"}`}
      >
        {origin ? (
          <QRCode value={url} size={168} bgColor="#ffffff" fgColor="#0f172a" />
        ) : (
          <div
            className="grid h-[168px] w-[168px] place-items-center rounded-xl bg-slate-100 text-xs text-ink-500"
            aria-hidden="true"
          >
            loading QR…
          </div>
        )}
      </div>

      <p className="mt-3 break-all font-mono text-[11px] text-ink-500">{url}</p>

      <div className="print-hide mt-4 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href={`/q/${meta.slug}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-colors hover:bg-brand-700"
        >
          Simulate scanning →
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
        >
          Print poster
        </button>
      </div>
    </article>
  );
}
