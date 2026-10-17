import Link from "next/link";
import { VENUE_LIST } from "@/lib/venues";
import { QrCodeCard } from "@/components/QrCodeCard";

export const metadata = {
  title: "Scan a venue QR — Queue Mitra",
};

export default function ScanPage() {
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="print-hide text-sm">
        <Link href="/" className="text-brand-700 hover:underline">
          ← Home
        </Link>
      </nav>

      <header className="print-hide">
        <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">
          📷 Simulate scanning a venue QR
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          In the real deployment, each counter has a printed poster like the
          ones below. Scanning it opens that venue's queue page in the
          browser — <strong>no app install, no login</strong>. For this demo,
          just tap “Simulate scanning” to jump straight to the visitor page.
        </p>
      </header>

      <div className="print-hide rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-900">
        <strong>Demo note:</strong> the QR codes below encode this app's local
        URL (<span className="font-mono text-xs">/q/&lt;venue&gt;</span>). If
        you open this page on a phone on the same Wi-Fi as the dev machine,
        you can actually scan them. Otherwise use the buttons.
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {VENUE_LIST.map((meta) => (
          <QrCodeCard key={meta.slug} meta={meta} />
        ))}
      </div>

      <p className="print-hide text-center text-xs text-ink-500">
        Tip: “Print poster” hides the app chrome and prints just the QR cards.
      </p>
    </div>
  );
}
