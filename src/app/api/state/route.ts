import { ensureDb, readState } from "@/server/db";
import { errorResponse, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/state — the full queue state (venues, counters, tickets). */
export async function GET(): Promise<Response> {
  try {
    await ensureDb();
    return json(readState());
  } catch (error) {
    return errorResponse(error);
  }
}
