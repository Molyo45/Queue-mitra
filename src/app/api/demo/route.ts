import { ensureDb } from "@/server/db";
import { errorResponse, json, readJson, requireStaff } from "@/server/http";
import { resetDemo, simulateWalkIn } from "@/server/queue-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DemoBody {
  action?: unknown;
  venue?: unknown;
}

/**
 * POST /api/demo — demo-only helpers (staff PIN required).
 *
 *   action: "walkin" → add one clearly-labelled simulated visitor
 *   action: "reset"  → restore the seeded demo data for every venue
 */
export async function POST(request: Request): Promise<Response> {
  try {
    await ensureDb();
    requireStaff(request);
    const body = await readJson<DemoBody>(request);

    switch (body.action) {
      case "walkin": {
        const result = simulateWalkIn(body.venue);
        return json(result, 201);
      }
      case "reset":
        return json({ state: resetDemo() });
      default:
        return json(
          { error: { code: "unknown_action", message: "Unknown demo action." } },
          400,
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
