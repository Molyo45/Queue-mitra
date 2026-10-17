import { ensureDb, readState } from "@/server/db";
import { errorResponse, json } from "@/server/http";
import { onQueueChange } from "@/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/state/stream — Server-Sent Events stream of queue changes.
 *
 * This is the backend's realtime transport: the moment any ticket or counter
 * changes, every connected visitor/staff tab receives the new state within a
 * few milliseconds. Clients that cannot hold an SSE connection fall back to
 * polling `/api/state`.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    await ensureDb();
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  function cleanup() {
    if (closed) return;
    closed = true;
    unsubscribe();
    if (heartbeat) clearInterval(heartbeat);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const sendState = () => {
        try {
          send(`data: ${JSON.stringify(readState())}\n\n`);
        } catch {
          // Database went away — tell the client and stop.
          send(`event: error\ndata: {"error":"state_unavailable"}\n\n`);
          cleanup();
        }
      };

      // Initial snapshot so a fresh subscriber is immediately up to date.
      send("retry: 3000\n\n");
      sendState();

      unsubscribe = onQueueChange(sendState);
      heartbeat = setInterval(() => send(": keep-alive\n\n"), 15000);

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Prevent reverse proxies (nginx) from buffering the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
