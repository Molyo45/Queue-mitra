/**
 * SQLite persistence for Queue Mitra.
 *
 * Uses the built-in `node:sqlite` module (Node 22.5+), so there is **no
 * external database, no cloud account and no extra npm dependency** — the
 * database is a single file on disk. That keeps the hackathon demo runnable
 * offline and cheap, while still giving real persistence across refreshes and
 * app restarts.
 *
 * Everything here is synchronous (that is how `node:sqlite` works) and lives on
 * the Node server only.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseSync, SQLOutputValue } from "node:sqlite";

import { DEMO_VERSION, seedState } from "@/lib/demo-data";
import type { Counter, QueueState, Ticket, TicketStatus, VenueSlug } from "@/lib/types";
import { VENUES } from "@/lib/venues";

/* ------------------------------- errors ------------------------------- */

/** Thrown when the SQLite backend cannot be opened (e.g. old Node build). */
export class BackendUnavailableError extends Error {
  readonly code = "backend_unavailable";
  constructor(message: string) {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

/* ------------------------------ connection ---------------------------- */

type SqliteModule = typeof import("node:sqlite");

let sqliteModule: SqliteModule | null | undefined;

async function loadSqlite(): Promise<SqliteModule> {
  if (sqliteModule === undefined) {
    try {
      sqliteModule = await import("node:sqlite");
    } catch {
      sqliteModule = null;
    }
  }
  if (!sqliteModule) {
    throw new BackendUnavailableError(
      "This server's Node build does not include the built-in SQLite module " +
        "(node:sqlite). Node 22.5+ (ideally 24+) is required. The app will " +
        "keep working in local demo mode.",
    );
  }
  return sqliteModule;
}

const globalRef = globalThis as unknown as { __queueMitraDb?: DatabaseSync };

function databasePath(): string {
  const raw = process.env.QUEUE_MITRA_DB_PATH?.trim() || "data/queue-mitra.db";
  if (raw === ":memory:") return raw;
  return resolve(process.cwd(), raw);
}

/** The open database, if `ensureDb()` has run. */
function db(): DatabaseSync {
  if (!globalRef.__queueMitraDb) {
    throw new BackendUnavailableError("The database has not been initialised yet.");
  }
  return globalRef.__queueMitraDb;
}

/**
 * Open (once) and migrate the database. Safe to call from every request.
 */
export async function ensureDb(): Promise<DatabaseSync> {
  if (globalRef.__queueMitraDb) return globalRef.__queueMitraDb;

  const { DatabaseSync: Database } = await loadSqlite();
  const path = databasePath();
  if (path !== ":memory:") {
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch (error) {
      throw new BackendUnavailableError(
        `Could not prepare the database folder for ${path}. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    }
  }

  let database: DatabaseSync;
  try {
    database = new Database(path);
  } catch (error) {
    throw new BackendUnavailableError(
      `Could not open the SQLite database at ${path}. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
  }

  try {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec("PRAGMA busy_timeout = 5000;");
    migrate(database);
    seedIfNeeded(database);
  } catch (error) {
    try {
      database.close();
    } catch {
      /* ignore */
    }
    throw error;
  }

  globalRef.__queueMitraDb = database;
  return database;
}

/** True when the SQLite backend has already been opened successfully. */
export function isDbReady(): boolean {
  return Boolean(globalRef.__queueMitraDb);
}

/* -------------------------------- schema ------------------------------- */

function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS venues (
      slug   TEXT PRIMARY KEY,
      name   TEXT NOT NULL,
      prefix TEXT NOT NULL,
      paused INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS counters (
      id                TEXT PRIMARY KEY,
      venue_slug        TEXT NOT NULL REFERENCES venues(slug),
      label             TEXT NOT NULL,
      active            INTEGER NOT NULL DEFAULT 1,
      current_ticket_id TEXT,
      sort              INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id              TEXT PRIMARY KEY,
      venue_slug      TEXT NOT NULL REFERENCES venues(slug),
      no              TEXT NOT NULL,
      name            TEXT NOT NULL,
      service_type_id TEXT,
      status          TEXT NOT NULL CHECK (
        status IN ('waiting','called','served','skipped','noshow')
      ),
      joined_at       INTEGER NOT NULL,
      called_at       INTEGER,
      served_at       INTEGER,
      counter_id      TEXT,
      is_simulated    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS idempotency (
      key        TEXT PRIMARY KEY,
      ticket_id  TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_venue_status
      ON tickets(venue_slug, status);
    CREATE INDEX IF NOT EXISTS idx_tickets_joined
      ON tickets(joined_at);
  `);
}

/* --------------------------------- meta -------------------------------- */

function metaGet(database: DatabaseSync, key: string): string | undefined {
  const row = database.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? String(row.value) : undefined;
}

function metaSet(database: DatabaseSync, key: string, value: string): void {
  database
    .prepare(
      "INSERT INTO meta(key, value) VALUES(?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

/* -------------------------------- seeding ------------------------------ */

/**
 * Seed venues/counters/tickets from the demo fixture on first run, or whenever
 * the seed shape version changes (mirrors the old localStorage `DEMO_VERSION`
 * behaviour).
 */
function seedIfNeeded(database: DatabaseSync): void {
  const stored = metaGet(database, "seed_version");
  if (stored === String(DEMO_VERSION)) return;

  database.exec("DELETE FROM tickets; DELETE FROM counters; DELETE FROM venues; DELETE FROM idempotency;");
  database.exec("BEGIN IMMEDIATE");
  try {
    const insertVenue = database.prepare(
      "INSERT INTO venues(slug, name, prefix, paused) VALUES(?, ?, ?, 0)",
    );
    for (const slug of Object.keys(VENUES) as VenueSlug[]) {
      const meta = VENUES[slug];
      insertVenue.run(slug, meta.name, meta.prefix);
    }

    const seed = seedState();
    insertTickets(database, seed.tickets);

    const insertCounter = database.prepare(
      "INSERT INTO counters(id, venue_slug, label, active, current_ticket_id, sort) " +
        "VALUES(?, ?, ?, ?, ?, ?)",
    );
    seed.counters.forEach((counter, index) => {
      insertCounter.run(
        counter.id,
        counter.venue,
        counter.label,
        counter.active ? 1 : 0,
        counter.currentTicketId ?? null,
        index,
      );
    });

    metaSet(database, "seq_canteen", String(seed.seq.canteen));
    metaSet(database, "seq_admin", String(seed.seq.admin));
    metaSet(database, "updated_at", String(Date.now()));
    metaSet(database, "seed_version", String(DEMO_VERSION));
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
}

function insertTickets(database: DatabaseSync, tickets: Ticket[]): void {
  const insert = database.prepare(
    "INSERT INTO tickets(id, venue_slug, no, name, service_type_id, status, " +
      "joined_at, called_at, served_at, counter_id, is_simulated) " +
      "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const ticket of tickets) {
    insert.run(
      ticket.id,
      ticket.venue,
      ticket.no,
      ticket.name,
      ticket.serviceTypeId ?? null,
      ticket.status,
      ticket.joinedAt,
      ticket.calledAt ?? null,
      ticket.servedAt ?? null,
      ticket.counterId ?? null,
      ticket.isSimulated ? 1 : 0,
    );
  }
}

/* --------------------------------- rows -------------------------------- */

function rowToTicket(row: Record<string, SQLOutputValue>): Ticket {
  return {
    id: String(row.id),
    venue: String(row.venue_slug) as VenueSlug,
    no: String(row.no),
    name: String(row.name),
    serviceTypeId: row.service_type_id == null ? undefined : String(row.service_type_id),
    status: String(row.status) as TicketStatus,
    joinedAt: Number(row.joined_at),
    calledAt: row.called_at == null ? undefined : Number(row.called_at),
    servedAt: row.served_at == null ? undefined : Number(row.served_at),
    counterId: row.counter_id == null ? undefined : String(row.counter_id),
    isSimulated: Boolean(row.is_simulated),
  };
}

function rowToCounter(row: Record<string, SQLOutputValue>): Counter {
  return {
    id: String(row.id),
    venue: String(row.venue_slug) as VenueSlug,
    label: String(row.label),
    active: Boolean(row.active),
    currentTicketId: row.current_ticket_id == null ? undefined : String(row.current_ticket_id),
  };
}

/* ------------------------------- reading ------------------------------- */

/** Build the full client-facing queue state from the database. */
export function readState(): QueueState {
  const database = db();

  const closed = { canteen: false, admin: false } as Record<VenueSlug, boolean>;
  for (const row of database.prepare("SELECT slug, paused FROM venues").all()) {
    closed[String(row.slug) as VenueSlug] = Boolean(row.paused);
  }

  const counters = database
    .prepare("SELECT * FROM counters ORDER BY venue_slug, sort")
    .all()
    .map(rowToCounter);

  const tickets = database
    .prepare("SELECT * FROM tickets ORDER BY joined_at")
    .all()
    .map(rowToTicket);

  const version = Number(metaGet(database, "seed_version") ?? DEMO_VERSION);

  return {
    version,
    tickets,
    counters,
    closed,
    seq: {
      canteen: Number(metaGet(database, "seq_canteen") ?? 1),
      admin: Number(metaGet(database, "seq_admin") ?? 1),
    },
    updatedAt: Number(metaGet(database, "updated_at") ?? Date.now()),
  };
}

/* ------------------------------ query helpers ---------------------------- */

export function getTicketRow(id: string): Ticket | undefined {
  const row = db().prepare("SELECT * FROM tickets WHERE id = ?").get(id);
  return row ? rowToTicket(row) : undefined;
}

export function getCounterRow(id: string): Counter | undefined {
  const row = db().prepare("SELECT * FROM counters WHERE id = ?").get(id);
  return row ? rowToCounter(row) : undefined;
}

export function isVenuePaused(venue: VenueSlug): boolean {
  const row = db().prepare("SELECT paused FROM venues WHERE slug = ?").get(venue);
  return row ? Boolean(row.paused) : false;
}

/** The id of the longest-waiting ticket for a venue, or undefined. */
export function firstWaitingTicketId(venue: VenueSlug): string | undefined {
  const row = db()
    .prepare(
      "SELECT id FROM tickets WHERE venue_slug = ? AND status = 'waiting' ORDER BY joined_at ASC LIMIT 1",
    )
    .get(venue);
  return row ? String(row.id) : undefined;
}

/** Atomically take the next ticket number for a venue. Call inside a tx. */
export function takeNextSeq(venue: VenueSlug): number {
  const key = `seq_${venue}`;
  const next = Number(metaGet(db(), key) ?? 1);
  metaSet(db(), key, String(next + 1));
  return next;
}

export function findIdempotentTicketId(key: string): string | undefined {
  const row = db().prepare("SELECT ticket_id FROM idempotency WHERE key = ?").get(key);
  const id = row?.ticket_id;
  return id == null ? undefined : String(id);
}

export function rememberIdempotency(key: string, ticketId: string): void {
  db()
    .prepare(
      "INSERT INTO idempotency(key, ticket_id, created_at) VALUES(?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET ticket_id = excluded.ticket_id",
    )
    .run(key, ticketId, Date.now());
}

export function insertTicket(ticket: Ticket): void {
  insertTickets(db(), [ticket]);
}

export function updateTicket(
  id: string,
  patch: {
    status?: TicketStatus;
    calledAt?: number | null;
    servedAt?: number | null;
    counterId?: string | null;
  },
): void {
  const sets: string[] = [];
  const values: Array<string | number | null> = [];
  if (patch.status !== undefined) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.calledAt !== undefined) {
    sets.push("called_at = ?");
    values.push(patch.calledAt);
  }
  if (patch.servedAt !== undefined) {
    sets.push("served_at = ?");
    values.push(patch.servedAt);
  }
  if (patch.counterId !== undefined) {
    sets.push("counter_id = ?");
    values.push(patch.counterId);
  }
  if (sets.length === 0) return;
  values.push(id);
  db().prepare(`UPDATE tickets SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function setCounterCurrent(counterId: string, ticketId: string | null): void {
  db().prepare("UPDATE counters SET current_ticket_id = ? WHERE id = ?").run(ticketId, counterId);
}

export function clearCounterForTicket(ticketId: string): void {
  db().prepare("UPDATE counters SET current_ticket_id = NULL WHERE current_ticket_id = ?").run(ticketId);
}

export function setCounterActive(counterId: string, active: boolean): void {
  db().prepare("UPDATE counters SET active = ? WHERE id = ?").run(active ? 1 : 0, counterId);
}

export function setVenuePaused(venue: VenueSlug, paused: boolean): void {
  db().prepare("UPDATE venues SET paused = ? WHERE slug = ?").run(paused ? 1 : 0, venue);
}

/** Stamp the change time and keep the served/skipped history bounded. */
export function touch(): void {
  metaSet(db(), "updated_at", String(Date.now()));
}

export function pruneClosedTickets(venue: VenueSlug, keep = 80): void {
  db()
    .prepare(
      `DELETE FROM tickets
         WHERE venue_slug = ?
           AND status IN ('served','skipped','noshow')
           AND id NOT IN (
             SELECT id FROM tickets
               WHERE venue_slug = ?
                 AND status IN ('served','skipped','noshow')
               ORDER BY COALESCE(served_at, called_at, joined_at) DESC
               LIMIT ?
           )`,
    )
    .run(venue, venue, keep);
}

/* ------------------------------ transactions ----------------------------- */

/** Run `fn` inside an IMMEDIATE transaction, rolling back on error. */
export function tx<T>(fn: () => T): T {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
}

/* --------------------------------- reset -------------------------------- */

/** Wipe and re-seed the whole database (demo helper). */
export function resetDatabase(): void {
  const database = db();
  database.exec("DELETE FROM tickets; DELETE FROM counters; DELETE FROM venues; DELETE FROM idempotency;");
  metaSet(database, "seed_version", "");
  seedIfNeeded(database);
}
