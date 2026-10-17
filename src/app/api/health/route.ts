import { ensureDb } from "@/server/db";
import { usingDemoPin } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — quick backend status.
 *
 * Used by tooling and the README's setup check. The client itself probes
 * `/api/state` to decide between backend mode and local demo mode.
 */
export async function GET(): Promise<Response> {
  try {
    await ensureDb();
    return Response.json({
      ok: true,
      backend: "sqlite",
      realtime: "sse",
      node: process.version,
      demoPinHint: usingDemoPin() ? "1234" : undefined,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        backend: "unavailable",
        realtime: "none",
        message: error instanceof Error ? error.message : "Backend unavailable.",
      },
      { status: 503 },
    );
  }
}
