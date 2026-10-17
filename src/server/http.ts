/**
 * Small HTTP helpers shared by the API route handlers: consistent JSON
 * responses, error mapping, and staff-PIN checking.
 *
 * The staff PIN comes from the `STAFF_PIN` environment variable. It defaults to
 * the demo PIN `1234` so the hackathon build runs with zero configuration, but
 * the value is never written into source and can be overridden per deployment.
 */

import { timingSafeEqual } from "node:crypto";

import { ApiErrorBody } from "@/lib/types";

import { BackendUnavailableError } from "./db";
import { DomainError } from "./queue-service";

/** The configured staff PIN (env first, demo default otherwise). */
export function staffPin(): string {
  return process.env.STAFF_PIN?.trim() || "1234";
}

/** True when the deployment is still using the built-in demo PIN. */
export function usingDemoPin(): boolean {
  return staffPin() === "1234";
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Enforce the staff PIN on staff-only endpoints. Throws a `DomainError`. */
export function requireStaff(request: Request): void {
  const provided = request.headers.get("x-staff-pin") ?? "";
  if (!safeEqual(provided, staffPin())) {
    throw new DomainError(401, "unauthorized", "Incorrect staff PIN. Please unlock the dashboard again.");
  }
}

/** Read and parse a JSON body, with a friendly error on malformed input. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new DomainError(400, "invalid_json", "The request body must be valid JSON.");
  }
}

export function json<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/** Turn any thrown value into a consistent, useful JSON error response. */
export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, field: error.field },
    };
    return Response.json(body, { status: error.status });
  }
  if (error instanceof BackendUnavailableError) {
    return Response.json(
      {
        error: {
          code: "backend_unavailable",
          message:
            "The Queue Mitra backend is unavailable, so this request wasn't saved. " +
            "The app keeps working in local demo mode.",
        },
      } satisfies ApiErrorBody,
      { status: 503 },
    );
  }
  console.error("[queue-mitra] unexpected API error:", error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong on the server. Please try again.",
      },
    } satisfies ApiErrorBody,
    { status: 500 },
  );
}
