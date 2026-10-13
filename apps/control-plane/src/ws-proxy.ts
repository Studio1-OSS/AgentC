import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import type { EnvironmentService } from "./services/environments.js";
import { handleSessionSocket } from "@cloud-agent/agent-runtime";
import { verifyUiToken } from "./ui-tokens.js";

/**
 * Browser → server-side Pi; its tools execute through the Daytona SDK.
 * Browser never sees model or Daytona credentials.
 */
export function attachUiWebSocketProxy(
  server: HttpServer,
  service: EnvironmentService,
  uiSecret: string,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    void handleUpgrade(req, socket, head, wss, service, uiSecret);
  });

  return wss;
}

async function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  wss: WebSocketServer,
  service: EnvironmentService,
  uiSecret: string,
): Promise<void> {
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.pathname !== "/ui/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token") ?? "";
    const payload = verifyUiToken(token, uiSecret);
    if (!payload) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const registry = await service.getRuntimeSessionRegistry(
      payload.userId,
      payload.environmentId,
      payload.piSessionId,
      payload.projectId,
    );

    wss.handleUpgrade(req, socket, head, (client) => {
      void handleSessionSocket(client, payload.piSessionId, registry);
    });
  } catch (err) {
    try {
      socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
    } catch {
      // ignore
    }
    socket.destroy();
    console.error("UI WS upgrade failed", err);
  }
}
