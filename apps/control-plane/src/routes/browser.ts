import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getCookie, getSignedCookie, setCookie, setSignedCookie } from "hono/cookie";
import { bodyLimit } from "hono/body-limit";
import type { AuthVariables } from "../middleware/auth.js";
import type { EnvironmentService } from "../services/environments.js";
import { createProjectRoutes, requirePublicGitHubRepo } from "./projects.js";
import { verifyUiToken, type UiTokenPayload } from "../ui-tokens.js";

/** Browser ownership comes from its guest cookie or a grant for one linked workspace. */
export function createBrowserRoutes(
  service: EnvironmentService,
  secret: string,
) {
  const app = new Hono<{ Variables: AuthVariables & { workspaceGrant: UiTokenPayload | null } }>();
  app.use("*", bodyLimit({ maxSize: 8192 }));
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      if (!origin) {
        return c.json({ error: "Request must come from this website" }, 403);
      }
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return c.json({ error: "Request must come from this website" }, 403);
      }
      const host = c.req.header("host") ?? "";
      const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim() ?? "";

      const isLoopback = (h: string) => {
        const hostname = h.split(":")[0]?.toLowerCase();
        return (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1" ||
          hostname === "[::1]"
        );
      };

      const isMatchingHost =
        originHost === host || (Boolean(forwardedHost) && originHost === forwardedHost);
      const isDevLoopback =
        isLoopback(originHost) &&
        (isLoopback(host) || (Boolean(forwardedHost) && isLoopback(forwardedHost)));

      if (!isMatchingHost && !isDevLoopback) {
        return c.json({ error: "Request must come from this website" }, 403);
      }
    }
    const authorization = c.req.header("authorization");
    const token = authorization
      ? authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
      : getCookie(c, "cloud_agent_workspace") ?? "";
    const payload = verifyUiToken(token, secret);
    c.set("workspaceGrant", payload);
    const match = c.req.path.match(/^(?:\/ui\/api)?\/environments\/([^/]+)(?:\/|$)/);
    const listing = ["GET", "HEAD"].includes(c.req.method) && /^(?:\/ui\/api)?\/environments\/?$/.test(c.req.path);
    if (payload && (match?.[1] === payload.environmentId || (authorization && listing))) {
      c.set("userId", payload.userId);
      return next();
    }
    if (authorization) {
      return c.json({ error: "Chat token cannot access this workspace" }, 403);
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
  app.get("/bootstrap", async (c) => {
    const token = c.req.query("t") ?? c.req.query("token") ?? "";
    try {
      const data = await service.getUiBootstrap(token);
      const workspaceToken = data.token ?? token;
      const payload = verifyUiToken(workspaceToken, secret);
      if (!payload) throw new Error("invalid or expired UI token");
      // Keep the link's workspace grant separate from this browser's guest identity.
      setCookie(c, "cloud_agent_workspace", workspaceToken, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/ui",
        maxAge: Math.max(1, Math.ceil((payload.exp - Date.now()) / 1000)),
        secure: c.req.url.startsWith("https:") || c.req.header("x-forwarded-proto") === "https",
      });
      return c.json(data);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 401);
    }
  });
  app.route("/environments", createProjectRoutes(service, true));
  app.get("/environments", async (c) => {
    const grant = c.get("workspaceGrant");
    const environments = c.req.header("authorization") ? [] : await service.list(c.get("userId"));
    if (grant) {
      const shared = await service.get(grant.userId, grant.environmentId);
      if (shared && !environments.some((environment) => environment.id === shared.id)) environments.push(shared);
    }
    return c.json({ environments });
  });
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
