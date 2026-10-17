import { ensureDb } from "@/server/db";
import { errorResponse, json, readJson, requireStaff } from "@/server/http";
import { setPaused } from "@/server/queue-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VenueActionBody {
  action?: unknown;
  paused?: unknown;
}

/**
 * POST /api/venues/:slug — staff venue actions.
 *
 *   action: "pause" → pause/resume new tokens. Pass `paused: true|false` to set
 *   an explicit state, or omit it to toggle.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    await ensureDb();
    requireStaff(request);
    const { slug } = await context.params;
    const body = await readJson<VenueActionBody>(request);

    if (body.action !== "pause") {
      return json(
        { error: { code: "unknown_action", message: "Unknown venue action." } },
        400,
      );
    }
    return json({ state: setPaused(slug, body.paused) });
  } catch (error) {
    return errorResponse(error);
  }
}
