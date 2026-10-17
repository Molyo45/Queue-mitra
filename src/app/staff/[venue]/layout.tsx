import type { ReactNode } from "react";

import { VENUE_LIST } from "@/lib/venues";

/**
 * Needed so the static export (GitHub Pages) can pre-render each venue.
 * In normal server mode this is simply ignored.
 */
export function generateStaticParams() {
  return VENUE_LIST.map((venue) => ({ venue: venue.slug }));
}

export default function VenueSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
