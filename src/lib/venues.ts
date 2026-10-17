import type { VenueSlug } from "./types";

/** A kind of request a visitor can pick when joining (optional). */
export interface ServiceType {
  id: string;
  label: string;
  icon: string;
  /** Typical time to serve one visitor for this request (seconds). */
  avgServiceSeconds: number;
}

export interface VenueMeta {
  slug: VenueSlug;
  name: string;
  shortName: string;
  tagline: string;
  icon: string; // friendly emoji mark
  /** ticket number prefix, e.g. "C" -> "C-041" */
  prefix: string;
  hours: string;
  /**
   * Venue-wide default service time (seconds) used when a ticket has no
   * service type and by the demo simulator.
   */
  avgServiceSeconds: number;
  /**
   * Optional request types. The first entry is the default. Each carries its
   * own typical service time, which feeds the wait estimate.
   */
  serviceTypes: ServiceType[];
  /** live queue length thresholds for the busy indicator */
  busyThresholds: { moderate: number; busy: number };
  /** opening hour used by the arrival-rate chart (24h) */
  openHour: number;
  closeHour: number;
  /**
   * DEMO ARRIVAL-RATE DATA (not measured): expected visitors arriving every
   * 10 minutes, per hour starting at `openHour`. Used only for the rough
   * "come now vs later" comparison and clearly labelled as sample data.
   */
  sampleArrivalRatePer10Min: number[];
  /** arrivals/10min at or below this counts as "quiet" for the best-time hint */
  quietArrivalThreshold: number;
}

export const VENUES: Record<VenueSlug, VenueMeta> = {
  canteen: {
    slug: "canteen",
    name: "Campus Canteen",
    shortName: "Canteen",
    tagline: "Lunch rush, handled. Grab your token and study while you wait.",
    icon: "🍜",
    prefix: "C",
    hours: "8:00 AM – 7:00 PM",
    avgServiceSeconds: 120, // ~2 min per order
    serviceTypes: [
      { id: "meal", label: "Full meal", icon: "🍽️", avgServiceSeconds: 150 },
      { id: "snack", label: "Tea / snacks", icon: "☕", avgServiceSeconds: 60 },
    ],
    busyThresholds: { moderate: 4, busy: 7 },
    openHour: 8,
    closeHour: 19,
    //         8am 9  10 11 12  1pm 2  3  4  5  6pm
    sampleArrivalRatePer10Min: [1, 2, 3, 4, 8, 7, 4, 2, 3, 4, 2],
    quietArrivalThreshold: 3,
  },
  admin: {
    slug: "admin",
    name: "Student Admin Office",
    shortName: "Admin Office",
    tagline:
      "Certificates, Bonafide & transcripts — know the wait before you walk.",
    icon: "🏛️",
    prefix: "A",
    hours: "9:30 AM – 5:00 PM",
    avgServiceSeconds: 300, // ~5 min per request
    serviceTypes: [
      {
        id: "cert",
        label: "Certificate / Bonafide",
        icon: "📄",
        avgServiceSeconds: 360,
      },
      {
        id: "fee",
        label: "Fee / form enquiry",
        icon: "🧾",
        avgServiceSeconds: 180,
      },
    ],
    busyThresholds: { moderate: 3, busy: 6 },
    openHour: 9,
    closeHour: 17,
    //         9am 10 11 12 1pm 2  3  4pm
    sampleArrivalRatePer10Min: [2, 3, 4, 3, 1, 4, 3, 2],
    quietArrivalThreshold: 2,
  },
};

export const VENUE_LIST: VenueMeta[] = [VENUES.canteen, VENUES.admin];

export function isVenueSlug(value: string): value is VenueSlug {
  return value === "canteen" || value === "admin";
}

export function getVenue(slug: string): VenueMeta | null {
  return isVenueSlug(slug) ? VENUES[slug] : null;
}

/** The default (first) service type for a venue. */
export function defaultServiceType(meta: VenueMeta): ServiceType {
  return meta.serviceTypes[0];
}

export function serviceTypeById(
  meta: VenueMeta,
  id: string | undefined,
): ServiceType | undefined {
  if (!id) return undefined;
  return meta.serviceTypes.find((s) => s.id === id);
}
