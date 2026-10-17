import { errorResponse, json, readJson, staffPin, usingDemoPin } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SessionBody {
  pin?: unknown;
}

/**
 * POST /api/staff/session — verify a staff PIN.
 *
 * The client stores the verified PIN in sessionStorage and sends it as the
 * `x-staff-pin` header on staff actions. The PIN itself lives in the
 * `STAFF_PIN` environment variable (demo default `1234`).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson<SessionBody>(request);
    const pin = typeof body.pin === "string" ? body.pin : "";
    if (pin.length === 0 || pin !== staffPin()) {
      return json(
        { error: { code: "unauthorized", message: "Incorrect PIN. Check the demo PIN below." } },
        401,
      );
    }
    return json({ ok: true, demoPinHint: usingDemoPin() ? "1234" : undefined });
  } catch (error) {
    return errorResponse(error);
  }
}
