import type { Counter, QueueState, Ticket, VenueSlug } from "./types";
import { VENUES } from "./venues";

export const DEMO_VERSION = 4;

const MIN = 60_000;

function ticket(
  venue: VenueSlug,
  seq: number,
  name: string,
  joinedMinAgo: number,
  now: number,
  extra?: Partial<Ticket>,
): Ticket {
  const meta = VENUES[venue];
  return {
    id: `${venue}-${seq}`,
    venue,
    no: `${meta.prefix}-${String(seq).padStart(3, "0")}`,
    name,
    joinedAt: now - joinedMinAgo * MIN,
    status: "waiting",
    // default to the venue's first service type unless overridden
    serviceTypeId: meta.serviceTypes[0].id,
    ...extra,
  };
}

/**
 * Realistic seeded queue for the hackathon demo.
 *
 * Everything here is DEMO DATA: hand-picked names, plausible join times
 * relative to "now", and a few already-served tickets so the staff stats
 * aren't empty on first load.
 */
export function seedState(now: number = Date.now()): QueueState {
  const tickets: Ticket[] = [
    /* ---------------- Campus Canteen ---------------- */
    // served earlier (keeps staff stats non-empty on first load)
    ticket("canteen", 29, "Harsh Trivedi", 68, now, {
      status: "served",
      calledAt: now - 58 * MIN,
      servedAt: now - 55 * MIN,
    }),
    ticket("canteen", 30, "Priya Desai", 61, now, {
      status: "served",
      calledAt: now - 50 * MIN,
      servedAt: now - 47 * MIN,
    }),
    ticket("canteen", 31, "Yash Modi", 54, now, {
      status: "served",
      calledAt: now - 44 * MIN,
      servedAt: now - 42 * MIN,
    }),
    ticket("canteen", 32, "Riya Kapoor", 47, now, {
      status: "called",
      calledAt: now - 90_000,
      counterId: "cnt-c2",
    }),
    // the live queue (mix of request types so estimates vary)
    ticket("canteen", 33, "Aarav Shah", 24, now, { serviceTypeId: "meal" }),
    ticket("canteen", 34, "Diya Patel", 19, now, { serviceTypeId: "snack" }),
    ticket("canteen", 35, "Rohan Mehta", 15, now, { serviceTypeId: "meal" }),
    ticket("canteen", 36, "Ananya Iyer", 12, now, { serviceTypeId: "snack" }),
    ticket("canteen", 37, "Kabir Singh", 9, now, { serviceTypeId: "meal" }),
    ticket("canteen", 38, "Meera Nair", 6, now, { serviceTypeId: "meal" }),
    ticket("canteen", 39, "Vivaan Rao", 3, now, { serviceTypeId: "snack" }),
    ticket("canteen", 40, "Sara Khan", 1, now, { serviceTypeId: "meal" }),

    /* ---------------- Student Admin Office ---------------- */
    ticket("admin", 8, "Nisha Gupta", 62, now, {
      status: "served",
      calledAt: now - 50 * MIN,
      servedAt: now - 43 * MIN,
    }),
    ticket("admin", 9, "Aditya Bose", 55, now, {
      status: "served",
      calledAt: now - 42 * MIN,
      servedAt: now - 35 * MIN,
    }),
    ticket("admin", 10, "Tanvi Joshi", 49, now, {
      status: "noshow",
      calledAt: now - 30 * MIN,
    }),
    ticket("admin", 11, "Ishaan Verma", 20, now, { serviceTypeId: "cert" }),
    ticket("admin", 12, "Sneha Reddy", 12, now, { serviceTypeId: "fee" }),
    ticket("admin", 13, "Zaid Ansari", 6, now, { serviceTypeId: "cert" }),
    ticket("admin", 14, "Pooja Menon", 2, now, { serviceTypeId: "fee" }),
  ];

  const counters: Counter[] = [
    { id: "cnt-c1", venue: "canteen", label: "Counter 1", active: true },
    {
      id: "cnt-c2",
      venue: "canteen",
      label: "Counter 2",
      active: true,
      currentTicketId: "canteen-32",
    },
    { id: "adm-a1", venue: "admin", label: "Counter 1", active: true },
    { id: "adm-a2", venue: "admin", label: "Counter 2", active: true },
  ];

  return {
    version: DEMO_VERSION,
    tickets,
    counters,
    closed: { canteen: false, admin: false },
    seq: { canteen: 41, admin: 15 },
  };
}

/** Names the simulator rotates through for "walk-in" visitors. */
export const SIM_NAMES = [
  "Aarav Shah",
  "Diya Patel",
  "Rohan Mehta",
  "Ananya Iyer",
  "Kabir Singh",
  "Meera Nair",
  "Vivaan Rao",
  "Sara Khan",
  "Ishaan Verma",
  "Tanvi Joshi",
  "Aditya Bose",
  "Nisha Gupta",
  "Zaid Ansari",
  "Sneha Reddy",
];
