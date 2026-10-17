# Queue Mitra — QR virtual queue (backend + realtime)

**PS-2 · Reducing Waiting Time in Everyday Queues** (GDG IIIT Surat · DevSprint Hackathon)

A QR-based virtual queue for campus venues. Visitors scan a poster QR, take a token from
their phone, watch a live wait estimate, and get reminded when their turn is close. Staff
call and serve tickets from a simple dashboard. No cameras, no sensors, no extra hardware.

The queue is stored in a real backend (**SQLite** via Node's built-in `node:sqlite`) and the
visitor and staff screens are kept in sync over **Server-Sent Events (SSE)**, with an
automatic polling fallback. If the backend is unreachable the app keeps working in a
browser-only **local demo mode** — so the demo can never get stuck.

> ⚠️ **Estimates, not guarantees.** Wait times are simple, explainable arithmetic
> (`people ahead ÷ open counters × average service time`) — **not AI**. The queue is
> seeded with **clearly-labelled sample data**; the arrival-rate history is demo data.
> See [Limitations & honesty](#limitations--honesty).

---

## ▶ Run it (setup & run instructions)

**Requirements:** **Node 22.5+** (24+ recommended) for the built-in `node:sqlite`
module. Built and tested on **Node 26**. No external services, cloud database or paid
add-ons — the only dependency needed for the backend is Node itself.

```bash
cd "Default Project"

# 1. Install dependencies
npm install

# 2. (Optional) copy the env template — the app runs fine without it
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

Open **http://localhost:3000**. The slim status bar under the header should read
**“Live · streaming updates”**.

Production build (stop the dev server first, so `.next` isn’t in use):

```bash
npm run build
npm start
```

### Backend configuration

The backend is the Next.js Route Handlers running on the Node runtime, persisting to a
single SQLite file. Everything is optional for a local demo:

| Variable | Default | Purpose |
|----------|---------|---------|
| `STAFF_PIN` | `1234` | PIN for the staff dashboard. **Set your own for anything beyond a local demo.** The server only shows the “demo PIN” hint while the default is in use. |
| `QUEUE_MITRA_DB_PATH` | `data/queue-mitra.db` | SQLite file path, relative to the project root (the folder is created automatically). Use `:memory:` for an ephemeral DB. |
| `NEXT_PUBLIC_POLL_MS` | `2000` | Client refresh interval (ms, min 500) used only when realtime is unavailable. |

The database file and `.env*` are git-ignored. No secrets are committed. To start from a
clean seeded database, delete the `data/` folder (or press **Reset demo data** in the app).

### Local demo fallback (no backend)

The app auto-detects an unavailable backend and switches to local demo mode — nothing to
configure. To force it:

- stop the backend (or block `/api/*`), then reload, **or**
- click **Use demo mode** in the status bar when it shows “Backend unreachable”.

In this mode the queue lives in your browser (`localStorage`), still syncs across tabs via
`BroadcastChannel`, and the demo PIN is `1234`. Data never leaves the device.

---

## 🎬 2-minute judge demo walkthrough

**Before you start (once):** run `npm run dev` and open two windows side by side —
one at **`/q/canteen`** (visitor) and one at **`/staff/canteen`** (staff). Staff needs
the PIN (**`1234`** unless you set `STAFF_PIN`). Keep the home page in a third tab if you
like.

| ~time | Do this | What to say / point out |
|------|---------|-------------------------|
| **0:00** | On **`/`** (home) | “Students scan a poster QR — no app, no login.” The two venue cards show **live** waiting counts straight from the backend. Scroll to **“How we estimate your wait”** for the one-line formula. |
| **0:15** | Visitor window → **`/q/canteen`** | “This is what a student sees.” Point at the **busy pill**, the **“Should I come now or later?”** card (live queue vs. labelled demo arrival-rate data), and the estimate before joining. |
| **0:35** | Visitor: enter a name, pick a **request type**, click **Join queue** | A token appears with **people ahead**, a **live estimated-wait countdown**, and the **“How is my wait estimated?”** breakdown showing the exact arithmetic. |
| **0:55** | Staff window → **`/staff/canteen`**, unlock with **1234** | “The same queue, from the counter’s side.” The ticket you just made is already in the **Waiting queue** — **sync is live over SSE**, no refresh. The visitor window updated the instant you joined. |
| **1:10** | Staff: **Call next** (or the row’s **Call** button) | The visitor window flips to **“Your turn — go to Counter 1”** *live*, and stats update on the staff side. |
| **1:25** | Staff: **Mark served** | The visitor window shows the success state; the ticket moves to **Recently closed**; counters free up. |
| **1:40** | Staff: **switch Counter 1 off** (it's free), then look at the visitor window | The open-counter count drops and the estimate **rises live** — same math, recalculated on every change. (Switching off a counter that's mid-service is blocked with a message, so the queue can't end up in a weird state.) |
| **1:55** | Staff: **↺ Reset demo data** (one click) | Every venue returns to the seeded demo queue instantly. Ready for the next run. |

**Optional extras if you have another 30 seconds:**

- **Phone demo:** open `http://<your-laptop-ip>:3000/q/canteen` on a phone on the same
  Wi‑Fi and scan the QR on the **`/scan`** page — it really works across devices.
- **Resilience:** stop the dev server and reload — the amber **“Local demo mode”** banner
  appears and the app keeps working. Restart it and the data is still there (**SQLite
  persistence**).
- **Rush:** in the staff **Demo controls**, press **⚡ Simulate rush (4)** to fill the queue
  with clearly-labelled simulated visitors.

> Nothing in this walkthrough needs real setup beyond `npm install` + `npm run dev`.
> No API keys, accounts or credentials are required.

---

## How it works

```
Phone (visitor) ──┐
                  ├── HTTP  ──►  Next.js Route Handlers  ──►  SQLite file
Staff dashboard ──┘                     │  (Node runtime)
                                        │  emits on every change
        ▲                               ▼
        └──────── SSE /api/state/stream (live push) ────────┘
                 (falls back to polling /api/state)
```

- **Backend:** Next.js **Route Handlers** on the Node runtime, persisting to a single
  **SQLite** file. Chosen because it needs no external credentials and is trivially
  demonstrable — start the dev server and it just works.
- **Realtime:** the backend’s realtime mechanism is **SSE** (`GET /api/state/stream`). Every
  queue change is pushed to all connected visitor/staff tabs immediately. While live, a light
  **reconcile** also re-syncs `GET /api/state` every ~15s so a dropped event self-heals (and
  if the connection drops, the client reconnects to SSE automatically after 30s).
- **Fallback:** if a client can’t hold an SSE connection it automatically **polls**
  `/api/state` (default every 2s, configurable) and the status bar switches to
  **“Near-live · refreshing every few seconds”**, always showing when the data was **last
  refreshed**.
- **Local demo mode:** if the backend is unreachable, the store transparently falls back to
  the in-browser engine (`localStorage` + `BroadcastChannel`) with a clear amber banner.

---

## What's implemented

### Visitor

- Scan/link entry → join with an optional name + optional **request type** (no account).
- Ticket number, people ahead, position, **live estimated-wait countdown**, ETA clock and a
  progress tracker (Joined → In queue → Turn soon → At counter → Done).
- Turn reminder (in-app toast + optional browser notification), leave queue (inline
  confirm), rejoin, and served / no-show / left states.
- **“Should I come now or later?”** — live queue vs. the best remaining hour from **demo
  arrival-rate data**, plus the arrivals **actually observed** in the last hour (labelled).

### Staff

- Lightweight PIN gate (verified server-side).
- Live stats (waiting · being served · served today · average wait · no-shows).
- Counters: **call next**, **mark served**, **no-show**, **switch on/off**.
- Waiting list with row actions, recently-closed list with **recall**, and **pause/resume**
  new tokens.

### Demo controls (staff page)

- **+ Simulate walk-in**, **⚡ Simulate rush (4)**, and a one-click **↺ Reset demo data** that
  restores every venue to the seeded queue.

### Explainable wait estimate

`estimated wait = (people ahead ÷ open counters) × average service time`, recalculated
automatically whenever someone joins, leaves, is served, or a counter is paused/resumed.
Shown in-app on the home page and the visitor page, and as a per-ticket breakdown.

---

## Reliability & UX details

- **Duplicate submissions:** the join button disables while in flight and each join attempt
  carries an idempotency key, so a double-submit or retry creates **one** ticket.
- **Accidental repeated staff actions:** every staff control locks while its request is in
  flight, and the server validates state transitions — calling a busy counter, serving an
  already-served ticket, or double no-showing returns a friendly message instead of
  corrupting the queue. Each mutation runs in an SQLite transaction.
- **Loading / empty / error states:** skeletons while hydrating, empty states for an empty
  queue, connection states (connecting · live · near-live · offline · local), and clear
  backend error messages surfaced as toasts.
- **Offline:** the status bar shows **“Backend unreachable”** with **Retry** and **Use demo
  mode** actions; the last known data stays on screen and the app stays usable.
- **Clear wording:** every wait number is labelled an estimate with a “not a guarantee”
  explainer; the live queue is distinguished from demo arrival-rate assumptions.
- **Accessibility:** mobile-first layouts, controls ≥44px tall, semantic landmarks,
  `aria-live` status announcements, `role="switch"`, `role="alert"` on errors, `aria-busy`
  while saving, visible focus rings, colour never used alone, and `prefers-reduced-motion`
  respected.

---

## API reference

All handlers are `runtime = "nodejs"`. Errors use a consistent shape:
`{ "error": { "code", "message", "field?" } }` with sensible status codes
(`400` validation, `401` staff, `404`, `409` conflict/state, `503` backend unavailable).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET`  | `/api/health` | — | Backend status (`backend`, `realtime`, node version) |
| `GET`  | `/api/state` | — | Full queue state (`tickets`, `counters`, `closed`, `seq`, `updatedAt`) |
| `GET`  | `/api/state/stream` | — | **SSE** stream of state updates |
| `POST` | `/api/tickets` | — | Join a queue (`venue`, `name?`, `serviceTypeId?`, `requestKey?`) |
| `POST` | `/api/tickets/:id` | staff* | `{ action: "cancel" \| "serve" \| "noshow" \| "recall" }` |
| `POST` | `/api/counters/:id` | staff | `{ action: "call" \| "toggle" }` |
| `POST` | `/api/venues/:slug` | staff | `{ action: "pause", paused? }` |
| `POST` | `/api/demo` | staff | `{ action: "walkin", venue }` or `{ action: "reset" }` |
| `POST` | `/api/staff/session` | — | Verify a staff PIN (`{ pin }`) |

\* `cancel` is a visitor action and needs no PIN; the other ticket actions do.

**Staff auth:** staff requests send the verified PIN in the `x-staff-pin` header (stored in
`sessionStorage` after a successful `POST /api/staff/session`). This is a lightweight
stand-in for real authentication.

---

## Limitations & honesty

We keep the demo honest — here is exactly what is real and what is simulated.

**Simulated / sample data**

- **The queue contents are seeded demo data**, not real people: names, join times, request
  types and the served history in `src/lib/demo-data.ts` are hand-written samples. They are
  reproduced in the SQLite database on first run / reset and are labelled in the UI.
- **The arrival-rate chart and hourly “typical at …” numbers are assumptions** (sample data
  in `src/lib/venues.ts`), not measured traffic. Only **“recent arrivals”** (last 60 min) is
  counted from real ticket join times — and it is noisy when few people have joined.
- **Simulated visitors** added from the staff demo controls are flagged `sim`.

**Estimate accuracy**

- Waits are a **rough arithmetic estimate** — `(people ahead ÷ open counters) × average
  service time`. They are **not AI**, **not a prediction model**, and **not a guarantee**.
- Accuracy depends on the **average service time** assumption (per request type). If real
  service is faster or slower than assumed, or a counter stalls, the estimate drifts. It is
  a guide to help people decide *when* to come, not a commitment.
- No-shows, counter pauses and batch arrivals can all move the real wait away from the
  estimate; the number recalculates on every queue change to stay as close as it can.

**Scope / not built**

- **Auth** is a shared staff **PIN**, not real accounts or roles.
- **Reminders** are in-app toasts + browser notifications only — **no SMS/WhatsApp/push**.
- **Single-instance SQLite** suits a demo/single server; a hosted, horizontally-scaled
  deployment would point at a managed database.
- No cameras, sensors, or hardware beyond a printed QR poster — by design.

---

## What's in the box

```
src/
  app/
    layout.tsx              App shell: header, status bar, footer, toasts
    page.tsx                Landing page + demo venue selection + wait explainer
    api/                    Backend route handlers (Node runtime)
      health/route.ts
      state/route.ts             GET full state
      state/stream/route.ts      GET SSE stream (realtime)
      tickets/route.ts           POST join
      tickets/[id]/route.ts      POST cancel/serve/noshow/recall
      counters/[id]/route.ts     POST call/toggle
      venues/[slug]/route.ts     POST pause
      demo/route.ts              POST walkin/reset (demo)
      staff/session/route.ts     POST verify PIN
    scan/page.tsx           QR / demo entry screen
    q/[venue]/page.tsx      Visitor queue page (join + live ticket)
    staff/[venue]/page.tsx  Staff dashboard
    not-found.tsx / error.tsx / loading.tsx   Error + loading states
  server/                   Backend domain (server-only)
    db.ts                   SQLite connection, schema, seeding, queries
    queue-service.ts        Validated queue operations + transactions
    http.ts                 JSON/error helpers, staff PIN check
    events.ts               In-process change bus for SSE
  components/               Header, Footer, BackendStatusBar, ToastHost, ui primitives,
                            ArrivalRateChart, QrCodeCard, QueueStatusStrip, NowServingStrip,
                            WaitEstimateExplainer, WhenToVisitCard, JoinForm, ProgressTracker,
                            TicketCard, StaffStats, CounterCard, TicketList, SimulatePanel,
                            StaffPinGate, VenueCard
  lib/
    types.ts                Shared Ticket / Counter / QueueState / connection types
    api.ts                  Typed client for the HTTP API (+ ApiError)
    store.ts                Store facade: backend (SSE/poll) or local, unified actions
    local-store.ts          In-browser fallback engine (localStorage + BroadcastChannel)
    venues.ts               Venue config + SAMPLE busy-hours data
    demo-data.ts            Seeded demo queue (also seeds the database)
    wait.ts                 Wait estimation + busy-level + arrival-rate logic
    toast.ts, hooks.ts, format.ts, cn.ts
```

---

## QA / review checklist (what to click)

| # | Go to | What to verify |
|---|-------|----------------|
| 1 | `/` | Landing page, hero, demo venues with **live** counts, the **wait-estimate explainer**, and the demo-data disclosure |
| 2 | Status bar | **Live · streaming updates · updated just now** |
| 3 | `/scan` | QR/demo entry. Real scannable QR codes + “Simulate scanning” buttons |
| 4 | `/q/canteen` | Visitor page: busy status, **“Should I come now or later?”**, join form with optional **request type** |
| 5 | Join the queue | Ticket number, people ahead, live countdown, **“How is my wait estimated?”**, reminder button |
| 6 | `/staff/canteen` | PIN gate (**1234**) → stats, counters, wait list, controls |
| 7 | Staff: **Call next** / **Mark served** | Visitor tab updates **live over SSE**; ticket moves to “Now serving”, then “Served” |
| 8 | Staff: **switch a counter off** → visitor page | Open counters drop and the estimate rises live |
| 9 | Staff: **Pause new tokens** → visitor page | Paused banner + join rejected with a clear message |
| 10 | Visitor: **Leave queue** | Inline confirm → “You left the queue” + rejoin |
| 11 | Staff: **↺ Reset demo data** | One click → queue/counters/history reset to the seed |
| 12 | Refresh the page | The queue is still there (**backend persistence**) — and survives a server restart |
| 13 | Stop the backend, reload | Amber **“Local demo mode”** banner; the app keeps working |
| 14 | `/q/unknown` or `/nonsense` | Friendly error states |

### Two-device demo

Open `/q/canteen` in one window and `/staff/canteen` in another:

1. Join on the visitor window → the ticket appears in the staff queue instantly.
2. **Call next** → the visitor window shows “Your turn — go to Counter 1”.
3. **Mark served** → the visitor window shows the success state.

With the backend running this works **across devices** (e.g. a phone scanning the LAN URL
`http://<your-ip>:3000/q/canteen`). Each **tab** is a separate visitor (my-ticket is stored
per tab in `sessionStorage`), while the shared queue is common to everyone.
