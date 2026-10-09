import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { bodyLimit } from "hono/body-limit";
import type { AuthVariables } from "../middleware/auth.js";
import type { EnvironmentService } from "../services/environments.js";
import { createProjectRoutes, requirePublicGitHubRepo } from "./projects.js";
import { verifyUiToken } from "../ui-tokens.js";

/** Guest workspaces belong to a signed browser cookie, never a client-supplied user ID. */
export function createBrowserRoutes(
  service: EnvironmentService,
  secret: string,
) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", bodyLimit({ maxSize: 8192 }));
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      if (!origin || new URL(origin).host !== c.req.header("host")) {
        return c.json({ error: "Request must come from this website" }, 403);
      }
    }
    const authorization = c.req.header("authorization");
    if (authorization) {
      const payload = authorization.startsWith("Bearer ") ? verifyUiToken(authorization.slice(7), secret) : null;
      const match = c.req.path.match(/^(?:\/ui\/api)?\/environments\/([^/]+)\/projects(?:\/|$)/);
      if (!payload || match?.[1] !== payload.environmentId) {
        return c.json({ error: "Chat token cannot access this workspace" }, 403);
      }
      c.set("userId", payload.userId);
      return next();
    }
    let userId = await getSignedCookie(c, secret, "cloud_agent_guest");
    if (!userId) {
      userId = `guest-${randomUUID()}`;
      await setSignedCookie(c, "cloud_agent_guest", userId, secret, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 30 * 86400,
        secure:
          c.req.url.startsWith("https:") ||
          c.req.header("x-forwarded-proto") === "https",
      });
    }
    c.set("userId", userId);
    await next();
  });
  app.onError((err, c) => c.json({ error: err.message }, 400));
  app.route("/environments", createProjectRoutes(service, true));
  app.get("/environments", async (c) =>
    c.json({ environments: await service.list(c.get("userId")) }),
  );
  app.post("/environments", async (c) => {
    const body = await c.req.json();
    if (body.repoUrl) requirePublicGitHubRepo(body.repoUrl);
    const envs = await service.list(c.get("userId"));
    if (envs.length >= 5)
      return c.json(
        {
          error:
            "You have five workspaces. Delete one before creating another.",
        },
        429,
      );
    return c.json(await service.create(c.get("userId"), body), 202);
  });
  app.get("/environments/:id", async (c) => {
    const env = await service.get(c.get("userId"), c.req.param("id"));
    return env ? c.json(env) : c.json({ error: "Workspace not found" }, 404);
  });
  app.post("/environments/:id/chat", async (c) => {
    return c.json(
      await service.resumeUiChat(c.get("userId"), c.req.param("id")),
    );
  });
  app.post("/environments/:id/start", async (c) =>
    c.json(await service.start(c.get("userId"), c.req.param("id"))),
  );
  app.post("/environments/:id/stop", async (c) =>
    c.json(await service.stop(c.get("userId"), c.req.param("id"))),
  );
  app.delete("/environments/:id", async (c) => {
    const env = await service.get(c.get("userId"), c.req.param("id"));
    if (!env) return c.json({ error: "Workspace not found" }, 404);
    if (["creating", "starting", "stopping"].includes(env.status))
      return c.json(
        { error: "Wait for the workspace operation to finish" },
        409,
      );
    return c.json(await service.remove(c.get("userId"), c.req.param("id")));
  });
  return app;
}
