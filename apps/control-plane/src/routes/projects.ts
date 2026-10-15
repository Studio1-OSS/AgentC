import { Hono } from "hono";
import { OpenProjectChatSchema, SessionRequestSchema } from "@agentc/protocol";
import type { EnvironmentService } from "../services/environments.js";
import type { AuthVariables } from "../middleware/auth.js";

export function requirePublicGitHubRepo(repoUrl: unknown): void {
  const message = "Enter a public GitHub repository URL, like https://github.com/owner/repo";
  if (typeof repoUrl !== "string") throw new Error(message);
  const url = new URL(repoUrl);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password ||
      !/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname) || url.search || url.hash) throw new Error(message);
}

export function createProjectRoutes(service: EnvironmentService, browser = false) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.onError((err, c) => c.json({ error: err.message }, 400));
  app.get("/:id/projects", (c) => c.json({ projects: service.listProjects(c.get("userId"), c.req.param("id")) }));
  app.post("/:id/projects", async (c) => {
    const body = await c.req.json();
    if (browser && body.repoUrl) requirePublicGitHubRepo(body.repoUrl);
    return c.json(await service.createProject(c.get("userId"), c.req.param("id"), body), 202);
  });
  app.get("/:id/projects/:projectId/sessions", async (c) => c.json({
    sessions: await service.listProjectSessions(c.get("userId"), c.req.param("id"), c.req.param("projectId")),
  }));
  app.post("/:id/projects/:projectId/sessions", async (c) => {
    const body = SessionRequestSchema.parse(await c.req.json());
    return c.json(await service.openUiChat(c.get("userId"), c.req.param("id"), { ...body, projectId: c.req.param("projectId") }), 201);
  });
  app.post("/:id/projects/:projectId/chat", async (c) => {
    const body = OpenProjectChatSchema.parse(await c.req.json());
    const userId = c.get("userId"), environmentId = c.req.param("id"), projectId = c.req.param("projectId");
    return c.json(body.sessionId
      ? await service.openUiChat(userId, environmentId, { ...body, projectId })
      : await service.resumeUiChat(userId, environmentId, projectId));
  });
  return app;
}
