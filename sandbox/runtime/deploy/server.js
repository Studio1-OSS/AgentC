import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/server.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer } from "ws";

// ../../packages/protocol/dist/index.js
import { z } from "zod";

// ../../packages/protocol/dist/llm-provider.js
var OPENROUTER_PROVIDER_ID = "openrouter";
var NEBIUS_PROVIDER_ID = "nebius";
var DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
var DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-235b-a22b-2507";
var DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1";
var DEFAULT_NEBIUS_MODEL = "moonshotai/Kimi-K2.7-Code";
var DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
var DEFAULT_OPENAI_MODEL = "gpt-4.1";
function resolveLlmProviderConfig(env) {
  const explicitProvider = env.PI_PROVIDER?.trim();
  if (env.OPENROUTER_API_KEY && (!explicitProvider || explicitProvider === OPENROUTER_PROVIDER_ID)) {
    return {
      providerId: OPENROUTER_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      apiKey: env.OPENROUTER_API_KEY,
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      baseUrl: env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL,
      api: "openai-completions",
      headers: {
        "HTTP-Referer": env.OPENROUTER_HTTP_REFERER?.trim() || "https://cloud-agent.local",
        "X-Title": env.OPENROUTER_APP_TITLE?.trim() || "cloud-agent"
      }
    };
  }
  if (explicitProvider === OPENROUTER_PROVIDER_ID) {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("PI_PROVIDER=openrouter requires OPENROUTER_API_KEY");
    }
    return {
      providerId: OPENROUTER_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      apiKey: env.OPENROUTER_API_KEY,
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      baseUrl: env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL,
      api: "openai-completions",
      headers: {
        "HTTP-Referer": env.OPENROUTER_HTTP_REFERER?.trim() || "https://cloud-agent.local",
        "X-Title": env.OPENROUTER_APP_TITLE?.trim() || "cloud-agent"
      }
    };
  }
  if (env.NEBIUS_API_KEY && (!explicitProvider || explicitProvider === NEBIUS_PROVIDER_ID)) {
    return {
      providerId: NEBIUS_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_NEBIUS_MODEL,
      apiKey: env.NEBIUS_API_KEY,
      apiKeyEnvVar: "NEBIUS_API_KEY",
      baseUrl: env.NEBIUS_BASE_URL?.trim() || DEFAULT_NEBIUS_BASE_URL,
      api: "openai-completions"
    };
  }
  if (explicitProvider === NEBIUS_PROVIDER_ID) {
    if (!env.NEBIUS_API_KEY) {
      throw new Error("PI_PROVIDER=nebius requires NEBIUS_API_KEY");
    }
    return {
      providerId: NEBIUS_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_NEBIUS_MODEL,
      apiKey: env.NEBIUS_API_KEY,
      apiKeyEnvVar: "NEBIUS_API_KEY",
      baseUrl: env.NEBIUS_BASE_URL?.trim() || DEFAULT_NEBIUS_BASE_URL,
      api: "openai-completions"
    };
  }
  if (env.ANTHROPIC_API_KEY && (!explicitProvider || explicitProvider === "anthropic")) {
    return {
      providerId: "anthropic",
      modelId: env.PI_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      apiKey: env.ANTHROPIC_API_KEY,
      apiKeyEnvVar: "ANTHROPIC_API_KEY",
      api: "anthropic-messages"
    };
  }
  if (env.OPENAI_API_KEY && (!explicitProvider || explicitProvider === "openai")) {
    return {
      providerId: "openai",
      modelId: env.PI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      apiKeyEnvVar: "OPENAI_API_KEY",
      api: "openai-responses"
    };
  }
  throw new Error("No LLM API key found. Set OPENROUTER_API_KEY (preferred for Daytona), NEBIUS_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.");
}
function buildOpenAICompatiblePiProviderRegistration(config, displayName) {
  if (!config.baseUrl || config.api !== "openai-completions") {
    throw new Error(`buildOpenAICompatiblePiProviderRegistration requires openai-completions + baseUrl for ${config.providerId}`);
  }
  return {
    name: displayName,
    baseUrl: config.baseUrl,
    api: "openai-completions",
    apiKey: config.apiKey,
    ...config.headers ? { headers: config.headers } : {},
    models: [
      {
        id: config.modelId,
        name: config.modelId,
        api: "openai-completions",
        reasoning: false,
        input: ["text"],
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0
        },
        contextWindow: 1048576,
        maxTokens: 8192
      }
    ]
  };
}
function buildNebiusPiProviderRegistration(config) {
  if (config.providerId !== NEBIUS_PROVIDER_ID || !config.baseUrl) {
    throw new Error("buildNebiusPiProviderRegistration requires a Nebius config");
  }
  return buildOpenAICompatiblePiProviderRegistration(config, "Nebius Token Factory");
}

// ../../packages/protocol/dist/index.js
var EnvironmentStatusSchema = z.enum([
  "creating",
  "ready",
  "sleeping",
  "starting",
  "stopping",
  "error",
  "deleted"
]);
var EnvironmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  sandboxId: z.string().nullable(),
  repoUrl: z.string().nullable(),
  repoBranch: z.string().nullable(),
  status: EnvironmentStatusSchema,
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActiveAt: z.string().nullable()
});
var CreateEnvironmentRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  repoUrl: z.string().url().refine((url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, { message: "repoUrl must be an http(s) URL" }).optional(),
  repoBranch: z.string().min(1).max(200).optional(),
  /** Optional empty workspace when no repo is provided. */
  initEmpty: z.boolean().optional().default(false)
});
var SessionRefSchema = z.object({
  id: z.string(),
  environmentId: z.string(),
  piSessionId: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable()
});
var ClientWsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("prompt"),
    content: z.string().min(1)
  }),
  z.object({
    type: z.literal("steer"),
    content: z.string().min(1)
  }),
  z.object({
    type: z.literal("follow_up"),
    content: z.string().min(1)
  }),
  z.object({
    type: z.literal("abort")
  }),
  z.object({
    type: z.literal("ping")
  })
]);
var ServerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.state"),
    sessionId: z.string(),
    title: z.string().nullable().optional(),
    messageCount: z.number().optional()
  }),
  z.object({
    type: z.literal("message.start"),
    role: z.enum(["user", "assistant", "tool"]),
    messageId: z.string().optional()
  }),
  z.object({
    type: z.literal("message.delta"),
    text: z.string(),
    channel: z.enum(["text", "thinking"]).optional()
  }),
  z.object({
    type: z.literal("message.end"),
    role: z.enum(["user", "assistant", "tool"]).optional(),
    text: z.string().optional(),
    thinking: z.string().optional(),
    content: z.unknown().optional()
  }),
  z.object({
    type: z.literal("tool.start"),
    tool: z.string(),
    callId: z.string(),
    args: z.unknown().optional()
  }),
  z.object({
    type: z.literal("tool.update"),
    tool: z.string(),
    callId: z.string(),
    partial: z.unknown().optional()
  }),
  z.object({
    type: z.literal("tool.end"),
    tool: z.string(),
    callId: z.string(),
    isError: z.boolean().optional(),
    result: z.unknown().optional()
  }),
  z.object({
    type: z.literal("run.start")
  }),
  z.object({
    type: z.literal("run.end")
  }),
  z.object({
    type: z.literal("compaction"),
    summary: z.string().optional()
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional()
  }),
  z.object({
    type: z.literal("pong")
  })
]);
var RuntimeSessionInfoSchema = z.object({
  id: z.string(),
  path: z.string().optional(),
  title: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  messageCount: z.number().optional(),
  firstMessage: z.string().optional()
});
var PreviewRequestSchema = z.object({
  port: z.number().int().min(1).max(65535),
  expiresInSeconds: z.number().int().min(60).max(86400).optional().default(3600)
});
var PreviewResponseSchema = z.object({
  url: z.string().url(),
  port: z.number(),
  expiresInSeconds: z.number().optional(),
  token: z.string().optional()
});
var DEFAULT_RUNTIME_PORT = 4096;
var DEFAULT_WORKSPACE_PATH = "/home/daytona/workspace/project";
var DEFAULT_PI_AGENT_DIR = "/home/daytona/.pi/agent";

// src/pi.ts
import {
  createAgentSession,
  ModelRuntime,
  SessionManager
} from "@earendil-works/pi-coding-agent";
import { mkdirSync } from "node:fs";

// src/events.ts
function mapPiEvent(event) {
  switch (event.type) {
    case "message_start":
      return [
        {
          type: "message.start",
          role: roleFromMessage(event.message),
          messageId: event.message.id
        }
      ];
    case "message_update": {
      const ame = event.assistantMessageEvent;
      if (ame?.type === "text_delta" && typeof ame.delta === "string") {
        return [{ type: "message.delta", text: ame.delta }];
      }
      if (ame?.type === "thinking_delta" && typeof ame.delta === "string") {
        return [
          { type: "message.delta", text: ame.delta, channel: "thinking" }
        ];
      }
      return [];
    }
    case "message_end": {
      const role = roleFromMessage(event.message);
      const failure = event.message;
      if (role === "assistant" && failure.stopReason === "error")
        return [
          { type: "message.end", role: "assistant", text: "" },
          {
            type: "error",
            message: failure.errorMessage || "The model failed to finish its response",
            code: "model_failed"
          }
        ];
      const content = event.message.content;
      return [
        {
          type: "message.end",
          role,
          ...role === "assistant" ? {
            text: extractMessageText(content),
            thinking: Array.isArray(content) ? content.filter((p) => p.type === "thinking").map((p) => p.thinking ?? "").join("\n") : "",
            content
          } : {}
        }
      ];
    }
    case "tool_execution_start":
      return [
        {
          type: "tool.start",
          tool: event.toolName,
          callId: event.toolCallId,
          args: event.args
        }
      ];
    case "tool_execution_update":
      return [
        {
          type: "tool.update",
          tool: event.toolName,
          callId: event.toolCallId,
          partial: event.partialResult
        }
      ];
    case "tool_execution_end":
      return [
        {
          type: "tool.end",
          tool: event.toolName,
          callId: event.toolCallId,
          isError: Boolean(event.isError),
          result: event.result
        }
      ];
    case "agent_start":
      return [{ type: "run.start" }];
    case "agent_settled":
    case "agent_end":
      return [{ type: "run.end" }];
    case "compaction_end":
      return [
        {
          type: "compaction",
          summary: event.result?.summary
        }
      ];
    default:
      return [];
  }
}
function roleFromMessage(message) {
  const role = message?.role;
  if (role === "toolResult") return "tool";
  if (role === "user" || role === "assistant" || role === "tool") return role;
  return "assistant";
}
function extractMessageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part) {
      return String(part.text ?? "");
    }
    return "";
  }).join("");
}

// src/pi.ts
var PiSessionRegistry = class {
  constructor(config) {
    this.config = config;
    mkdirSync(config.cwd, { recursive: true });
    mkdirSync(config.agentDir, { recursive: true });
  }
  active = /* @__PURE__ */ new Map();
  modelRuntimePromise = null;
  resolveLlm() {
    if (this.config.llm) return this.config.llm;
    return resolveLlmProviderConfig({
      PI_PROVIDER: this.config.provider,
      PI_MODEL: this.config.modelId,
      OPENROUTER_API_KEY: this.config.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
      OPENROUTER_BASE_URL: this.config.openrouterBaseUrl ?? process.env.OPENROUTER_BASE_URL,
      NEBIUS_API_KEY: this.config.nebiusApiKey ?? process.env.NEBIUS_API_KEY,
      NEBIUS_BASE_URL: this.config.nebiusBaseUrl ?? process.env.NEBIUS_BASE_URL,
      ANTHROPIC_API_KEY: this.config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: this.config.openaiApiKey ?? process.env.OPENAI_API_KEY
    });
  }
  async getModelRuntime() {
    if (!this.modelRuntimePromise) {
      this.modelRuntimePromise = (async () => {
        const llm2 = this.resolveLlm();
        const runtime = await ModelRuntime.create({
          authPath: `${this.config.agentDir}/auth.json`,
          modelsPath: `${this.config.agentDir}/models.json`
        });
        if (llm2.providerId === OPENROUTER_PROVIDER_ID) {
          await runtime.setRuntimeApiKey(OPENROUTER_PROVIDER_ID, llm2.apiKey);
        } else if (llm2.providerId === NEBIUS_PROVIDER_ID) {
          runtime.registerProvider(
            NEBIUS_PROVIDER_ID,
            buildNebiusPiProviderRegistration(llm2)
          );
          await runtime.setRuntimeApiKey(NEBIUS_PROVIDER_ID, llm2.apiKey);
        } else if (llm2.providerId === "anthropic") {
          await runtime.setRuntimeApiKey("anthropic", llm2.apiKey);
        } else if (llm2.providerId === "openai") {
          await runtime.setRuntimeApiKey("openai", llm2.apiKey);
        }
        return runtime;
      })();
    }
    return this.modelRuntimePromise;
  }
  async resolveModel(modelRuntime) {
    const llm2 = this.resolveLlm();
    let model = modelRuntime.getModel(llm2.providerId, llm2.modelId);
    if (!model) {
      throw new Error(
        `No model available for provider=${llm2.providerId} model=${llm2.modelId}`
      );
    }
    const maxOut = 8192;
    const maxCtx = 1e5;
    if ((model.maxTokens ?? 0) > maxOut || (model.contextWindow ?? 0) > maxCtx) {
      model = {
        ...model,
        maxTokens: Math.min(model.maxTokens ?? maxOut, maxOut),
        contextWindow: Math.min(model.contextWindow ?? maxCtx, maxCtx)
      };
    }
    return model;
  }
  async listSessions() {
    const sessions = await SessionManager.list(this.config.cwd);
    return sessions.map((s) => ({
      id: s.id,
      path: s.path,
      title: s.name ?? (s.firstMessage ? truncate(s.firstMessage, 80) : null),
      createdAt: s.created.toISOString(),
      modifiedAt: s.modified.toISOString(),
      messageCount: s.messageCount,
      firstMessage: s.firstMessage
    }));
  }
  async createSession(title) {
    const modelRuntime = await this.getModelRuntime();
    const model = await this.resolveModel(modelRuntime);
    const { session } = await createAgentSession({
      cwd: this.config.cwd,
      agentDir: this.config.agentDir,
      modelRuntime,
      model,
      sessionManager: SessionManager.create(this.config.cwd)
    });
    const id = session.sessionId;
    if (title) {
      try {
        session.setSessionName?.(title);
      } catch {
      }
    }
    this.track(session);
    return { id };
  }
  async openSession(sessionId) {
    const existing = this.active.get(sessionId);
    if (existing) return { id: sessionId };
    const sessions = await SessionManager.list(this.config.cwd);
    const match = sessions.find((s) => s.id === sessionId);
    if (!match) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const modelRuntime = await this.getModelRuntime();
    const model = await this.resolveModel(modelRuntime);
    const { session } = await createAgentSession({
      cwd: this.config.cwd,
      agentDir: this.config.agentDir,
      modelRuntime,
      model,
      sessionManager: SessionManager.open(match.path)
    });
    this.track(session);
    return { id: session.sessionId };
  }
  getOrThrow(sessionId) {
    const entry = this.active.get(sessionId);
    if (!entry) {
      throw new Error(
        `Session ${sessionId} is not open. Call open/create first.`
      );
    }
    return entry;
  }
  subscribe(sessionId, listener) {
    const entry = this.getOrThrow(sessionId);
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  }
  async prompt(sessionId, content) {
    const entry = this.getOrThrow(sessionId);
    this.emit(entry, { type: "run.start" });
    try {
      await entry.session.prompt(content);
    } catch (err) {
      this.emit(entry, {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
        code: "prompt_failed"
      });
      throw err;
    } finally {
      this.emit(entry, { type: "run.end" });
    }
  }
  async steer(sessionId, content) {
    const entry = this.getOrThrow(sessionId);
    await entry.session.steer(content);
  }
  async followUp(sessionId, content) {
    const entry = this.getOrThrow(sessionId);
    await entry.session.followUp(content);
  }
  async abort(sessionId) {
    const entry = this.getOrThrow(sessionId);
    await entry.session.abort();
  }
  getMessages(sessionId) {
    const entry = this.getOrThrow(sessionId);
    return entry.session.messages;
  }
  disposeSession(sessionId) {
    const entry = this.active.get(sessionId);
    if (!entry) return;
    entry.unsubscribe?.();
    entry.session.dispose();
    this.active.delete(sessionId);
  }
  disposeAll() {
    for (const id of [...this.active.keys()]) {
      this.disposeSession(id);
    }
  }
  track(session) {
    const id = session.sessionId;
    const entry = {
      session,
      listeners: /* @__PURE__ */ new Set()
    };
    entry.unsubscribe = session.subscribe((event) => {
      for (const mapped of mapPiEvent(event)) {
        this.emit(entry, mapped);
      }
    });
    this.active.set(id, entry);
  }
  emit(entry, event) {
    for (const listener of entry.listeners) {
      try {
        listener(event);
      } catch {
      }
    }
  }
};
function truncate(text, max) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}\u2026`;
}

// src/server.ts
var port = Number(process.env.RUNTIME_PORT ?? DEFAULT_RUNTIME_PORT);
var accessToken = process.env.RUNTIME_ACCESS_TOKEN ?? "";
var cwd = process.env.WORKSPACE_PATH ?? DEFAULT_WORKSPACE_PATH;
var agentDir = process.env.PI_AGENT_DIR ?? DEFAULT_PI_AGENT_DIR;
var llm = resolveLlmProviderConfig(process.env);
var registry = new PiSessionRegistry({
  cwd,
  agentDir,
  llm
});
var app = new Hono();
function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
}
function extractBearer(header) {
  if (!header) return "";
  return header.startsWith("Bearer ") ? header.slice(7) : header;
}
function requireAuth(c) {
  if (!accessToken) return true;
  const bearer = extractBearer(c.req.header("authorization"));
  const alt = c.req.header("x-runtime-token") ?? "";
  return bearer === accessToken || alt === accessToken;
}
app.get(
  "/health",
  (c) => c.json({
    ok: true,
    cwd,
    agentDir,
    provider: llm.providerId,
    model: llm.modelId,
    baseUrl: llm.baseUrl ?? null
  })
);
app.use("*", async (c, next) => {
  if (c.req.path === "/health") return next();
  if (!requireAuth(c)) return unauthorized();
  return next();
});
app.get(
  "/environment",
  (c) => c.json({
    cwd,
    agentDir,
    status: "ready"
  })
);
app.get("/sessions", async (c) => {
  const sessions = await registry.listSessions();
  return c.json({ sessions });
});
app.post("/sessions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
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
app.get(
  "/processes",
  (c) => c.json({
    note: "Process listing is best-effort in MVP; use Daytona preview ports from the control plane.",
    processes: []
  })
);
var server = serve(
  { fetch: app.fetch, port, hostname: "0.0.0.0" },
  (info) => {
    console.log(`sandbox-runtime listening on http://0.0.0.0:${info.port}`);
  }
);
var wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const match = url.pathname.match(/^\/ws\/sessions\/([^/]+)$/);
    if (!match) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    const token = url.searchParams.get("token") ?? extractBearer(req.headers.authorization) ?? "";
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
async function handleSessionSocket(ws, sessionId) {
  let unsubscribe;
  let closed = false;
  const send = (event) => {
    if (closed || ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify(event));
    } catch {
    }
  };
  try {
    await registry.openSession(sessionId);
    unsubscribe = registry.subscribe(sessionId, send);
    send({
      type: "session.state",
      sessionId,
      messageCount: registry.getMessages(sessionId).length
    });
  } catch (err) {
    send({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      code: "session_open_failed"
    });
    ws.close(1011, "session_open_failed");
    return;
  }
  ws.on("message", (data) => {
    void (async () => {
      let parsed;
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
          code: "bad_request"
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
          code: "agent_error"
        });
      }
    })();
  });
  ws.on("close", () => {
    closed = true;
    unsubscribe?.();
  });
}
var shutdown = () => {
  console.log("shutting down sandbox-runtime");
  registry.disposeAll();
  wss.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
export {
  app,
  registry
};
