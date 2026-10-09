import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDatabase, migrateDatabase, users, environments, projects, sessions } from "@cloud-agent/database";
import { EnvironmentService } from "./environments.js";
import { verifyUiToken } from "../ui-tokens.js";
import type { AppConfig } from "../config.js";

const databases: ReturnType<typeof createDatabase>[] = [];
afterEach(() => databases.splice(0).forEach((database) => database.sqlite.close()));

function setup() {
  const database = createDatabase(":memory:");
  databases.push(database);
  migrateDatabase(database.sqlite);
  const config = { workspacePath: "/home/daytona/workspace/project", runtimePort: 4096, browserSessionSecret: "test-secret", runtimeAccessSecret: "runtime-secret" } as AppConfig;
  const service = Object.create(EnvironmentService.prototype) as EnvironmentService;
  const runtime = new Map<string, Map<string, { title?: string; messages: unknown[] }>>();
  const fetchRuntime = vi.fn(async (_sandbox: unknown, path: string, init: RequestInit) => {
    const url = new URL(path, "http://runtime");
    if (url.pathname === "/health") return Response.json({ multiProject: true, model: "test", provider: "test" });
    const projectId = url.searchParams.get("projectId") ?? "default";
    let project = runtime.get(projectId);
    if (!project) { project = new Map(); runtime.set(projectId, project); }
    if (url.pathname === "/sessions") {
      if (init.method === "POST") {
        const id = randomUUID();
        project.set(id, { ...JSON.parse(String(init.body)), messages: [] });
        return Response.json({ id }, { status: 201 });
      }
      return Response.json({ sessions: [...project].map(([id, session]) => ({ id, title: session.title, running: false, messageCount: session.messages.length })) });
    }
    const id = url.pathname.split("/")[2]!;
    const session = project.get(id);
    return session ? Response.json({ id, messages: session.messages }) : Response.json({ error: `Session not found: ${id}` }, { status: 404 });
  });
  const sandboxes = {
    create: vi.fn(), get: vi.fn(async () => ({ state: "started" })),
    cloneRepository: vi.fn(async () => {}), initEmptyWorkspace: vi.fn(async () => {}),
    configureWebPreview: vi.fn(async () => {}), fetchRuntime,
    connectRuntimeSessionWs: vi.fn(async () => ({})),
  };
  Object.assign(service, { db: database.db, config, _sandboxes: sandboxes });
  database.db.insert(users).values([{ id: "owner", createdAt: "2026-01-01" }, { id: "other", createdAt: "2026-01-01" }]).run();
  database.db.insert(environments).values([
    { id: "workspace", userId: "owner", sandboxId: "shared-sandbox", name: "Original", status: "ready", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    { id: "other-workspace", userId: "other", sandboxId: "other-sandbox", name: "Other", status: "ready", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  ]).run();
  const createProject = async (name: string) => {
    const project = await service.createProject("owner", "workspace", { name, initEmpty: true });
    await vi.waitFor(() => expect(database.db.select().from(projects).where(eq(projects.id, project.id)).get()?.status).toBe("ready"));
    return project;
  };
  return { service, database, sandboxes, runtime, createProject };
}

describe("projects and conversations in a shared sandbox", () => {
  it("keeps the original directory and allocates distinct project directories and ports without creating another sandbox", async () => {
    const { service, sandboxes, createProject } = setup();
    const alpha = await createProject("Alpha"), beta = await createProject("Beta");
    const listed = service.listProjects("owner", "workspace");
    expect(listed.map((project) => project.previewPort)).toEqual([3000, 3001, 3002]);
    expect(listed[0]?.path).toBe("/home/daytona/workspace/project");
    expect(alpha.path).not.toBe(beta.path);
    expect(sandboxes.initEmptyWorkspace).toHaveBeenCalledWith(expect.anything(), alpha.path);
    expect(sandboxes.configureWebPreview).toHaveBeenCalledWith(expect.anything(), 3002);
    expect(sandboxes.create).not.toHaveBeenCalled();
  });

  it("lists, reopens and streams conversations only within their project and workspace", async () => {
    const { service, sandboxes, createProject } = setup();
    const alpha = await createProject("Alpha"), beta = await createProject("Beta");
    const first = await service.openUiChat("owner", "workspace", { projectId: alpha.id, title: "Plan" });
    await service.openUiChat("owner", "workspace", { projectId: alpha.id, title: "Implementation" });
    const unrelated = await service.openUiChat("owner", "workspace", { projectId: beta.id, title: "Other project" });
    const listed = await service.listProjectSessions("owner", "workspace", alpha.id);
    expect(listed.map((session) => session.title).sort()).toEqual(["Implementation", "Plan"]);
    const reopened = await service.openUiChat("owner", "workspace", { projectId: alpha.id, sessionId: first.sessionRefId! });
    expect(reopened.piSessionId).toBe(first.piSessionId);
    expect(reopened.sessionRefId).toBe(first.sessionRefId);
    expect(verifyUiToken(reopened.token, "test-secret")?.projectId).toBe(alpha.id);
    await expect(service.openUiChat("owner", "workspace", { projectId: alpha.id, sessionId: unrelated.sessionRefId! })).rejects.toThrow("Conversation not found");
    expect(() => service.listProjects("other", "workspace")).toThrow("forbidden");
    expect(() => service.getProject("other", "other-workspace", alpha.id)).toThrow("Project not found");
    await service.openRuntimeSessionSocket("owner", "workspace", first.piSessionId, alpha.id);
    expect(sandboxes.connectRuntimeSessionWs).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ projectId: alpha.id, previewPort: 3001 }));
  });

  it("bootstraps a vanished empty conversation by recreating it and handing back a new token", async () => {
    const { service, runtime, createProject } = setup();
    const project = await createProject("Alpha");
    const first = await service.openUiChat("owner", "workspace", { projectId: project.id, title: "Untouched chat" });
    runtime.get(project.id)!.clear();
    const boot = await service.getUiBootstrap(first.token);
    expect(boot.piSessionId).not.toBe(first.piSessionId);
    expect(boot.token).toBeTruthy();
    expect(boot.token).not.toBe(first.token);
    expect(boot.messages).toEqual([]);
    expect(runtime.get(project.id)!.get(boot.piSessionId)?.title).toBe("Untouched chat");
  });

  it("recreates an empty Pi session after restart while keeping its conversation entry and name", async () => {
    const { service, database, runtime, createProject } = setup();
    const project = await createProject("Alpha");
    const first = await service.openUiChat("owner", "workspace", { projectId: project.id, title: "Untouched chat" });
    runtime.get(project.id)!.clear();
    const reopened = await service.openUiChat("owner", "workspace", { projectId: project.id, sessionId: first.sessionRefId! });
    expect(reopened.sessionRefId).toBe(first.sessionRefId);
    expect(reopened.piSessionId).not.toBe(first.piSessionId);
    const refs = database.db.select().from(sessions).all();
    expect(refs).toHaveLength(1);
    expect(refs[0]?.title).toBe("Untouched chat");
    expect(runtime.get(project.id)!.get(reopened.piSessionId)?.title).toBe("Untouched chat");
  });

  it("preserves legacy sessions as default-project conversations", async () => {
    const { service, database, sandboxes } = setup();
    const id = randomUUID();
    database.db.insert(sessions).values({ id, environmentId: "workspace", piSessionId: "legacy", title: "Existing conversation", createdAt: "2026-01-01" }).run();
    const listed = await service.listProjectSessions("owner", "workspace", "default");
    expect(listed[0]).toMatchObject({ id, projectId: null, title: "Existing conversation" });
    expect(sandboxes.fetchRuntime).toHaveBeenCalledWith(expect.anything(), "/sessions", expect.anything());
    expect(database.db.select().from(projects).all()).toEqual([]);
  });

  it("reports clone failures on the new project without changing the original workspace", async () => {
    const { service, database, sandboxes } = setup();
    sandboxes.cloneRepository.mockRejectedValueOnce(new Error("Repository not found"));
    const project = await service.createProject("owner", "workspace", { repoUrl: "https://github.com/owner/missing" });
    await vi.waitFor(() => expect(database.db.select().from(projects).where(eq(projects.id, project.id)).get()).toMatchObject({ status: "error", errorMessage: "Repository not found" }));
    expect(service.getProject("owner", "workspace").status).toBe("ready");
  });
});

it("migrates an existing database without replacing its sessions", () => {
  const database = createDatabase(":memory:");
  databases.push(database);
  database.sqlite.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, environment_id TEXT NOT NULL, pi_session_id TEXT NOT NULL, title TEXT, created_at TEXT NOT NULL, last_active_at TEXT);
    INSERT INTO sessions VALUES ('original', 'workspace', 'pi-original', 'Keep me', '2026-01-01', NULL);`);
  migrateDatabase(database.sqlite);
  migrateDatabase(database.sqlite);
  expect(database.db.select().from(sessions).get()).toMatchObject({ id: "original", piSessionId: "pi-original", title: "Keep me", projectId: null });
});
