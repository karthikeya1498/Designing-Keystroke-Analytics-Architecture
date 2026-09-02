import { getSessionUsernameFromCookieHeader } from "../../../utils/auth";
import { subscribeSecurityStream } from "../../../../server/realtime/EventBus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { "content-type": "application/json" } });

  const encoder = new TextEncoder();
  let close: () => void = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: { type: string; payload: unknown }) => controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`));
      send({ type: "heartbeat", payload: { timestamp: Date.now() } });
      close = subscribeSecurityStream(userId, send);
      const heartbeat = setInterval(() => send({ type: "heartbeat", payload: { timestamp: Date.now() } }), 15_000);
      const abort = () => { clearInterval(heartbeat); close(); try { controller.close(); } catch { /* already closed */ } };
      request.signal.addEventListener("abort", abort, { once: true });
      setTimeout(abort, 30 * 60 * 1000);
    },
    cancel() { close(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
