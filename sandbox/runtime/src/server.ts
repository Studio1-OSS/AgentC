import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import type { Server as HttpServer } from "node:http";
import {
  DEFAULT_PI_AGENT_DIR,
  DEFAULT_RUNTIME_PORT,
  DEFAULT_WORKSPACE_PATH,
  RUNTIME_VERSION,
  resolveLlmProviderConfig,
} from "@cloud-agent/protocol";
import { ProjectRegistries } from "./projects.js";
import { handleSessionSocket } from "./socket.js";

const port = Number(process.env.RUNTIME_PORT ?? DEFAULT_RUNTIME_PORT);
const accessToken = process.env.RUNTIME_ACCESS_TOKEN ?? "";
const cwd = process.env.WORKSPACE_PATH ?? DEFAULT_WORKSPACE_PATH;
const agentDir = process.env.PI_AGENT_DIR ?? DEFAULT_PI_AGENT_DIR;
const llm = resolveLlmProviderConfig(process.env);

const projects = new ProjectRegistries({
  cwd,
  agentDir,
  llm,
});
const registry = projects.get();

const projectRegistry = (query: (name: string) => string | undefined) => projects.get(
  query("projectId") ?? "default",
  query("previewPort") === undefined ? undefined : Number(query("previewPort")),
);

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
    multiProject: true,
    runtimeVersion: RUNTIME_VERSION,
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
  const registry = projectRegistry((name) => c.req.query(name));
  const sessions = await registry.listSessions();
  return c.json({ sessions });
});

app.post("/sessions", async (c) => {
  const registry = projectRegistry((name) => c.req.query(name));
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const created = await registry.createSession(body.title);
  return c.json(created, 201);
});

app.get("/sessions/:id", async (c) => {
  const registry = projectRegistry((name) => c.req.query(name));
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
  const registry = projectRegistry((name) => c.req.query(name));
  const id = c.req.param("id");
  try {
    const opened = await registry.openSession(id);
    return c.json(opened);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 404);
  }
});

app.post("/sessions/:id/abort", async (c) => {
  const registry = projectRegistry((name) => c.req.query(name));
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

    const registry = projectRegistry((name) => url.searchParams.get(name) ?? undefined);
    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleSessionSocket(ws, sessionId, registry);
    });
  } catch {
    socket.destroy();
  }
});

const shutdown = () => {
  console.log("shutting down sandbox-runtime");
  projects.disposeAll();
  wss.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app, registry };
