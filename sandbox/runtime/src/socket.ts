import type { WebSocket } from "ws";
import { ClientWsMessageSchema, type ServerEvent } from "@cloud-agent/protocol";
import type { PiSessionRegistry } from "./pi.js";

export async function handleSessionSocket(ws: WebSocket, sessionId: string, registry: PiSessionRegistry): Promise<void> {
  let unsubscribe: (() => void) | undefined;
  let closed = false;
  const send = (event: ServerEvent) => {
    if (!closed && ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
  };
  ws.on("close", () => {
    closed = true;
    unsubscribe?.();
  });
  ws.on("error", () => ws.close());

  const ready = registry.openSession(sessionId);
  // Register before awaiting session loading so the browser's sync cannot be lost.
  ws.on("message", (data) => {
    void (async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        send({ type: "error", message: "invalid JSON", code: "bad_request" });
        return;
      }
      const result = ClientWsMessageSchema.safeParse(parsed);
      if (!result.success) {
        send({ type: "error", message: result.error.message, code: "bad_request" });
        return;
      }
      try {
        await ready;
        if (closed) return;
        const msg = result.data;
        switch (msg.type) {
          case "prompt":
            await registry.prompt(sessionId, msg.content);
            break;
          case "steer":
            await registry.steer(sessionId, msg.content);
            break;
          case "follow_up":
            await registry.followUp(sessionId, msg.content);
            break;
          case "abort":
            await registry.abort(sessionId);
            break;
          case "ping":
            send({ type: "pong", running: registry.isRunning(sessionId) });
            break;
          case "sync":
            send(registry.getState(sessionId));
            break;
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err), code: "agent_error" });
        if (closed) return;
        try {
          send(registry.getState(sessionId));
        } catch {
          ws.close(1011, "session_unavailable");
        }
      }
    })();
  });

  try {
    await ready;
    if (closed) return;
    unsubscribe = registry.subscribe(sessionId, send);
  } catch (err) {
    send({ type: "error", message: err instanceof Error ? err.message : String(err), code: "session_open_failed" });
    ws.close(1011, "session_open_failed");
  }
}
