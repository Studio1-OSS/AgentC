import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import type { EnvironmentService } from "./services/environments.js";
import { verifyUiToken } from "./ui-tokens.js";

/**
 * Browser → control-plane WS → Daytona runtime WS.
 * Browser never sees RUNTIME_ACCESS_SECRET or Daytona preview tokens.
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

    const upstream = await service.openRuntimeSessionSocket(
      payload.userId,
      payload.environmentId,
      payload.piSessionId,
      payload.projectId,
    );

    wss.handleUpgrade(req, socket, head, (client) => {
      pipeSockets(client, upstream);
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

function pipeSockets(client: WebSocket, upstream: WebSocket): void {
  const closeBoth = () => {
    try {
      if (client.readyState === WebSocket.OPEN) client.close();
    } catch {
      // ignore
    }
    try {
      if (upstream.readyState === WebSocket.OPEN) upstream.close();
    } catch {
      // ignore
    }
  };

  client.on("message", (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
    }
  });
  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  client.on("close", closeBoth);
  upstream.on("close", closeBoth);
  client.on("error", closeBoth);
  upstream.on("error", closeBoth);
}
