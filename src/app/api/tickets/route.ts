import { ensureDb } from "@/server/db";
import { errorResponse, json, readJson } from "@/server/http";
import { createTicket } from "@/server/queue-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateTicketBody {
  venue?: unknown;
  name?: unknown;
  serviceTypeId?: unknown;
  /** Client-generated idempotency key so a double-submit creates one ticket. */
  requestKey?: unknown;
}

/**
 * POST /api/tickets — a visitor joins a queue.
 *
 * Requires no auth. Sending the same `requestKey` twice returns the original
 * ticket instead of creating a duplicate.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    await ensureDb();
    const body = await readJson<CreateTicketBody>(request);
    const result = createTicket({
      venue: body.venue,
      name: body.name,
      serviceTypeId: body.serviceTypeId,
      requestKey: body.requestKey,
    });
    return json(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
