import { Hono } from "hono";
import type { EnvironmentService } from "../services/environments.js";
import type { AuthVariables } from "../middleware/auth.js";
import { createProjectRoutes } from "./projects.js";

export function createEnvironmentRoutes(service: EnvironmentService) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.route("/", createProjectRoutes(service));

  app.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await service.list(userId);
    return c.json({ environments: items });
  });

  app.post("/", async (c) => {
    const userId = c.get("userId");
    try {
      const body = await c.req.json();
      const env = await service.create(userId, body);
      return c.json(env, 202);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  app.get("/:id", async (c) => {
    const userId = c.get("userId");
    const env = await service.get(userId, c.req.param("id"));
    if (!env) return c.json({ error: "not found" }, 404);
    return c.json(env);
  });

  app.post("/:id/start", async (c) => {
    const userId = c.get("userId");
    try {
      const env = await service.start(userId, c.req.param("id"));
      return c.json(env);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  app.post("/:id/stop", async (c) => {
    const userId = c.get("userId");
    try {
      const env = await service.stop(userId, c.req.param("id"));
      return c.json(env);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  app.delete("/:id", async (c) => {
    const userId = c.get("userId");
    try {
      const result = await service.remove(userId, c.req.param("id"));
      return c.json(result);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  app.get("/:id/connection", async (c) => {
    const userId = c.get("userId");
    try {
      const conn = await service.getRuntimeConnection(userId, c.req.param("id"));
      return c.json(conn);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  app.get("/:id/sessions", async (c) => {
    const userId = c.get("userId");
    try {
      const data = await service.listSessions(userId, c.req.param("id"));
      return c.json(data);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  app.post("/:id/sessions", async (c) => {
    const userId = c.get("userId");
    try {
      const body = (await c.req.json().catch(() => ({}))) as { title?: string };
      const session = await service.createSession(
        userId,
        c.req.param("id"),
        body.title,
      );
      return c.json(session, 201);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  app.post("/:id/previews", async (c) => {
    const userId = c.get("userId");
    try {
      const body = await c.req.json();
      const preview = await service.createPreview(userId, c.req.param("id"), body);
      return c.json(preview);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  /** Mint a browser chat link (short-lived UI token). */
  app.post("/:id/ui", async (c) => {
    const userId = c.get("userId");
    try {
      const body = (await c.req.json().catch(() => ({}))) as {
        title?: string;
        piSessionId?: string;
      };
      const chat = await service.openUiChat(userId, c.req.param("id"), body);
      return c.json(chat);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  /** Authenticated HTTP access to the server-side agent runtime. */
  app.all("/:id/runtime/*", async (c) => {
    const userId = c.get("userId");
    const environmentId = c.req.param("id");
    const path = c.req.path.replace(`/environments/${environmentId}/runtime`, "") || "/";
    try {
      const headers = new Headers();
      const contentType = c.req.header("content-type");
      if (contentType) headers.set("content-type", contentType);

      const method = c.req.method;
      const hasBody = method !== "GET" && method !== "HEAD";
      const res = await service.proxyRuntime(userId, environmentId, path + (c.req.url.includes("?") ? `?${c.req.url.split("?")[1]}` : ""), {
        method,
        headers,
        body: hasBody ? await c.req.arrayBuffer() : undefined,
      });

      return new Response(res.body, {
        status: res.status,
        headers: {
          "content-type": res.headers.get("content-type") ?? "application/json",
        },
      });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  return app;
}
