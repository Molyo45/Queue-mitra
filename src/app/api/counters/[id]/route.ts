import { ensureDb } from "@/server/db";
import { errorResponse, json, readJson, requireStaff } from "@/server/http";
import { callNext, toggleCounter } from "@/server/queue-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CounterActionBody {
  action?: unknown;
}

/**
 * POST /api/counters/:id — staff counter actions.
 *
 *   action: "call"   → call the next waiting ticket to this counter
 *   action: "toggle" → pause / resume this counter
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await ensureDb();
    requireStaff(request);
    const { id } = await context.params;
    const body = await readJson<CounterActionBody>(request);

    switch (body.action) {
      case "call": {
        const result = callNext(id);
        return json(result);
      }
      case "toggle":
        return json({ state: toggleCounter(id) });
      default:
        return json(
          { error: { code: "unknown_action", message: "Unknown counter action." } },
          400,
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
