import { ensureDb } from "@/server/db";
import { errorResponse, json, readJson, requireStaff } from "@/server/http";
import {
  cancelTicket,
  noShowTicket,
  recallTicket,
  serveTicket,
} from "@/server/queue-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TicketActionBody {
  action?: unknown;
}

/**
 * POST /api/tickets/:id — act on a single ticket.
 *
 *   action: "cancel"  → visitor leaves (no auth)
 *   action: "serve"   → staff marks served
 *   action: "noshow"  → staff marks a no-show
 *   action: "recall"  → staff returns a skipped/no-show ticket to the queue
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await ensureDb();
    const { id } = await context.params;
    const body = await readJson<TicketActionBody>(request);
    const action = body.action;

    if (action === "cancel") {
      return json({ state: cancelTicket(id) });
    }

    requireStaff(request);

    switch (action) {
      case "serve":
        return json({ state: serveTicket(id) });
      case "noshow":
        return json({ state: noShowTicket(id) });
      case "recall":
        return json({ state: recallTicket(id) });
      default:
        return json(
          { error: { code: "unknown_action", message: "Unknown ticket action." } },
          400,
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
