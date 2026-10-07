import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import {
  ClientWsMessageSchema,
  DEFAULT_PI_AGENT_DIR,
  DEFAULT_RUNTIME_PORT,
  DEFAULT_WORKSPACE_PATH,
  resolveLlmProviderConfig,
  type ServerEvent,
} from "@cloud-agent/protocol";
import { PiSessionRegistry } from "./pi.js";

const port = Number(process.env.RUNTIME_PORT ?? DEFAULT_RUNTIME_PORT);
const accessToken = process.env.RUNTIME_ACCESS_TOKEN ?? "";
const cwd = process.env.WORKSPACE_PATH ?? DEFAULT_WORKSPACE_PATH;
const agentDir = process.env.PI_AGENT_DIR ?? DEFAULT_PI_AGENT_DIR;
const llm = resolveLlmProviderConfig(process.env);

const registry = new PiSessionRegistry({
  cwd,
  agentDir,
  llm,
});

const app = new Hono();

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function extractBearer(header: string | undefined): string {
  if (!header) return "";
  return header.startsWith("Bearer ") ? header.slice(7) : header;
}

function requireAuth(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  if (!accessToken) return true;
  const bearer = extractBearer(c.req.header("authorization"));
  const alt = c.req.header("x-runtime-token") ?? "";
  return bearer === accessToken || alt === accessToken;
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    cwd,
    agentDir,
    provider: llm.providerId,
    model: llm.modelId,
    baseUrl: llm.baseUrl ?? null,
  }),
);

app.use("*", async (c, next) => {
  if (c.req.path === "/health") return next();
  if (!requireAuth(c)) return unauthorized();
  return next();
});

app.get("/environment", (c) =>
  c.json({
    cwd,
    agentDir,
    status: "ready",
  }),
);

app.get("/sessions", async (c) => {
  const sessions = await registry.listSessions();
  return c.json({ sessions });
});

app.post("/sessions", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const created = await registry.createSession(body.title);
  return c.json(created, 201);
});

app.get("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await registry.openSession(id);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 404);
  }
  const messages = registry.getMessages(id);
  return c.json({ id, messages });
});

app.post("/sessions/:id/open", async (c) => {
  const id = c.req.param("id");
  try {
    const opened = await registry.openSession(id);
    return c.json(opened);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 404);
  }
});

app.post("/sessions/:id/abort", async (c) => {
  const id = c.req.param("id");
  try {
    await registry.abort(id);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 404);
  }
});

app.get("/processes", (c) =>
  c.json({
    note: "Process listing is best-effort in MVP; use Daytona preview ports from the control plane.",
    processes: [],
  }),
);

const server = serve(
  { fetch: app.fetch, port, hostname: "0.0.0.0" },
  (info) => {
    console.log(`sandbox-runtime listening on http://0.0.0.0:${info.port}`);
  },
);

const wss = new WebSocketServer({ noServer: true });

(server as HttpServer).on("upgrade", (req, socket, head) => {
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const match = url.pathname.match(/^\/ws\/sessions\/([^/]+)$/);
    if (!match) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const sessionId = decodeURIComponent(match[1]!);
    const token =
      url.searchParams.get("token") ??
      extractBearer(req.headers.authorization) ??
      "";

    if (accessToken && token !== accessToken) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleSessionSocket(ws, sessionId);
    });
  } catch {
    socket.destroy();
  }
});

async function handleSessionSocket(ws: WebSocket, sessionId: string): Promise<void> {
  let unsubscribe: (() => void) | undefined;
  let closed = false;

  const send = (event: ServerEvent) => {
    if (closed || ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify(event));
    } catch {
      // ignore
    }
  };

  try {
    await registry.openSession(sessionId);
    unsubscribe = registry.subscribe(sessionId, send);
    send({
      type: "session.state",
      sessionId,
      messageCount: registry.getMessages(sessionId).length,
    });
  } catch (err) {
    send({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      code: "session_open_failed",
    });
    ws.close(1011, "session_open_failed");
    return;
  }

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
        send({
          type: "error",
          message: result.error.message,
          code: "bad_request",
        });
        return;
      }

      const msg = result.data;
      try {
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
            send({ type: "pong" });
            break;
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
          code: "agent_error",
        });
      }
    })();
  });

  ws.on("close", () => {
    closed = true;
    unsubscribe?.();
  });
}

const shutdown = () => {
  console.log("shutting down sandbox-runtime");
  registry.disposeAll();
  wss.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app, registry };
