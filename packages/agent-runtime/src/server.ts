import { Hono } from "hono";
import { type LlmProviderConfig, RUNTIME_VERSION } from "@agentc/protocol";
import type { ProjectRegistries } from "./projects.js";

/** Internal requests stay in this process; no sandbox HTTP agent server is deployed. */
export function createRuntimeApp(projects: ProjectRegistries, llm: LlmProviderConfig) {
  const app = new Hono();
  const projectRegistry = (query: (name: string) => string | undefined) => projects.get(query("projectId") ?? "default", query("previewPort") === undefined ? undefined : Number(query("previewPort")));
  app.get("/health", (c) => c.json({ ok: true, multiProject: true, runtimeVersion: RUNTIME_VERSION, provider: llm.providerId, model: llm.modelId }));
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

  return app;
}
