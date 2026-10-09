import { randomUUID } from "node:crypto";
import { eq, and, ne, desc, isNull } from "drizzle-orm";
import {
  createDatabase,
  migrateDatabase,
  environments,
  sessions,
  projects,
  users,
  type AppDatabase,
  type EnvironmentRow,
  type ProjectRow,
} from "@cloud-agent/database";
import {
  CreateEnvironmentRequestSchema,
  PreviewRequestSchema,
  ProjectIdSchema,
  SessionRequestSchema,
  DEFAULT_WEB_PREVIEW_PORT,
  RUNTIME_VERSION,
  buildSandboxModelEnv,
  type EnvironmentStatus,
} from "@cloud-agent/protocol";
import {
  createSandboxClientFromEnv,
  type SandboxClient,
} from "@cloud-agent/sandbox-client";
import type { AppConfig } from "../config.js";
import { mintUiToken, verifyUiToken } from "../ui-tokens.js";
import { resolve, dirname, join } from "node:path";
import { existsSync } from "node:fs";

function nowIso(): string {
  return new Date().toISOString();
}

function toEnvironmentDto(row: EnvironmentRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    sandboxId: row.sandboxId,
    repoUrl: row.repoUrl,
    repoBranch: row.repoBranch,
    status: row.status as EnvironmentStatus,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastActiveAt: row.lastActiveAt,
  };
}

export class EnvironmentService {
  readonly db: AppDatabase;
  private _sandboxes: SandboxClient | null = null;

  constructor(private readonly config: AppConfig) {
    const { db, sqlite } = createDatabase(config.databaseUrl);
    migrateDatabase(sqlite);
    this.db = db;
  }

  get sandboxes(): SandboxClient {
    if (!this._sandboxes) {
      this._sandboxes = createSandboxClientFromEnv(process.env);
    }
    return this._sandboxes;
  }

  async ensureUser(userId: string): Promise<void> {
    const existing = this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (existing) return;
    this.db
      .insert(users)
      .values({
        id: userId,
        createdAt: nowIso(),
      })
      .run();
  }

  async list(userId: string) {
    const rows = this.db
      .select()
      .from(environments)
      .where(
        and(
          eq(environments.userId, userId),
          ne(environments.status, "deleted"),
        ),
      )
      .all();
    return rows.map(toEnvironmentDto);
  }

  async get(userId: string, id: string) {
    const row = this.db
      .select()
      .from(environments)
      .where(and(eq(environments.id, id), eq(environments.userId, userId)))
      .get();
    if (!row || row.status === "deleted") return null;
    return toEnvironmentDto(row);
  }

  async create(userId: string, rawBody: unknown) {
    const body = CreateEnvironmentRequestSchema.parse(rawBody);
    if (!body.repoUrl && !body.initEmpty) {
      throw new Error("Provide repoUrl or set initEmpty=true");
    }

    await this.ensureUser(userId);

    const id = randomUUID();
    const name =
      body.name ??
      (body.repoUrl
        ? deriveNameFromRepo(body.repoUrl)
        : `workspace-${id.slice(0, 8)}`);
    const createdAt = nowIso();

    this.db
      .insert(environments)
      .values({
        id,
        userId,
        name,
        sandboxId: null,
        repoUrl: body.repoUrl ?? null,
        repoBranch: body.repoBranch ?? null,
        status: "creating",
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
        lastActiveAt: createdAt,
      })
      .run();

    void this.provision(id).catch(async (err) => {
      console.error(`Failed to provision environment ${id}`, err);
      await this.setStatus(
        id,
        "error",
        err instanceof Error ? err.message : String(err),
      );
    });

    const row = this.requireRow(id);
    return toEnvironmentDto(row);
  }

  private async provision(environmentId: string): Promise<void> {
    const row = this.requireRow(environmentId);
    const runtimeToken = this.config.runtimeAccessSecret;

    const sandbox = await this.sandboxes.create({
      name: `env-${environmentId.slice(0, 8)}`,
      labels: {
        "cloud-agent/environment-id": environmentId,
        "cloud-agent/user-id": row.userId,
      },
      envVars: {
        RUNTIME_ACCESS_TOKEN: runtimeToken,
        ...buildSandboxModelEnv(process.env),
      },
    });

    this.db
      .update(environments)
      .set({
        sandboxId: sandbox.id,
        updatedAt: nowIso(),
      })
      .where(eq(environments.id, environmentId))
      .run();

    await this.sandboxes.ensureWorkspace(sandbox);

    if (row.repoUrl) {
      await this.sandboxes.cloneRepository(sandbox, {
        repoUrl: row.repoUrl,
        branch: row.repoBranch ?? undefined,
      });
    } else {
      await this.sandboxes.initEmptyWorkspace(sandbox);
    }

    const bundleDir = resolveRuntimeBundle(this.config.runtimeBundleDir);
    await this.sandboxes.deployAndStartRuntime(sandbox, {
      runtimeBundleLocalDir: bundleDir,
      runtimeAccessToken: runtimeToken,
      modelEnv: buildSandboxModelEnv(process.env),
    });

    await this.setStatus(environmentId, "ready");
  }

  async start(userId: string, id: string) {
    const row = this.requireOwned(userId, id);
    if (!row.sandboxId) throw new Error("Environment has no sandbox");

    await this.setStatus(id, "starting");
    try {
      const sandbox = await this.sandboxes.start(row.sandboxId);
      try {
        await this.sandboxes.waitForRuntimeHealthy(sandbox, 15_000);
        const health = await this.sandboxes.fetchRuntime(sandbox, "/health", {
          method: "GET",
          runtimeAccessToken: this.config.runtimeAccessSecret,
        });
        if (!health.ok || (await health.json() as { runtimeVersion?: number }).runtimeVersion !== RUNTIME_VERSION) {
          throw new Error("Sandbox runtime needs an upgrade");
        }
      } catch {
        const bundleDir = resolveRuntimeBundle(this.config.runtimeBundleDir);
        await this.sandboxes.deployAndStartRuntime(sandbox, {
          runtimeBundleLocalDir: bundleDir,
          runtimeAccessToken: this.config.runtimeAccessSecret,
          modelEnv: buildSandboxModelEnv(process.env),
        });
      }
      await this.sandboxes.configureWebPreview(sandbox);
      await this.setStatus(id, "ready");
    } catch (err) {
      await this.setStatus(
        id,
        "error",
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }

    return this.get(userId, id);
  }

  async stop(userId: string, id: string) {
    const row = this.requireOwned(userId, id);
    if (!row.sandboxId) throw new Error("Environment has no sandbox");

    await this.setStatus(id, "stopping");
    try {
      await this.sandboxes.stop(row.sandboxId);
      await this.setStatus(id, "sleeping");
    } catch (err) {
      await this.setStatus(
        id,
        "error",
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    const row = this.requireOwned(userId, id);
    if (row.sandboxId) {
      try {
        await this.sandboxes.delete(row.sandboxId);
      } catch (err) {
        console.warn(`Failed to delete sandbox ${row.sandboxId}`, err);
      }
    }
    this.db
      .update(environments)
      .set({
        status: "deleted",
        sandboxId: null,
        updatedAt: nowIso(),
      })
      .where(eq(environments.id, id))
      .run();
    return { ok: true };
  }

  async listSessions(userId: string, environmentId: string) {
    this.requireOwned(userId, environmentId);
    const env = this.requireRow(environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    if (env.status !== "ready") throw new Error(`Environment is ${env.status}`);

    const sandbox = await this.sandboxes.get(env.sandboxId);
    const res = await this.sandboxes.fetchRuntime(sandbox, "/sessions", {
      method: "GET",
      runtimeAccessToken: this.config.runtimeAccessSecret,
    });
    if (!res.ok) {
      throw new Error(
        `Runtime list sessions failed: ${res.status} ${await res.text()}`,
      );
    }
    return res.json();
  }

  getProject(userId: string, environmentId: string, projectId = "default"): ProjectRow {
    ProjectIdSchema.parse(projectId);
    const env = this.requireOwned(userId, environmentId);
    if (projectId === "default") {
      return {
        id: "default", environmentId, name: env.name, repoUrl: env.repoUrl,
        repoBranch: env.repoBranch, path: this.config.workspacePath,
        previewPort: DEFAULT_WEB_PREVIEW_PORT, createdAt: env.createdAt,
        status: env.status === "error" ? "error" : ["creating", "starting"].includes(env.status) ? "creating" : "ready",
        errorMessage: env.errorMessage,
      };
    }
    const project = this.db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.environmentId, environmentId))).get();
    if (!project) throw new Error("Project not found in this workspace");
    return project;
  }

  listProjects(userId: string, environmentId: string) {
    const original = this.getProject(userId, environmentId);
    return [original, ...this.db.select().from(projects).where(eq(projects.environmentId, environmentId)).orderBy(projects.createdAt).all()];
  }

  async createProject(userId: string, environmentId: string, rawBody: unknown) {
    const body = CreateEnvironmentRequestSchema.parse(rawBody);
    const env = this.requireOwned(userId, environmentId);
    if (env.status !== "ready" || !env.sandboxId) throw new Error("Wait until the sandbox is ready");
    const health = await this.proxyRuntime(userId, environmentId, "/health", { method: "GET" });
    if (!health.ok || !(await health.json() as { multiProject?: boolean }).multiProject) {
      throw new Error("Stop and resume this workspace to enable multiple projects");
    }
    const existing = this.db.select().from(projects).where(eq(projects.environmentId, environmentId)).all();
    let previewPort = Math.max(DEFAULT_WEB_PREVIEW_PORT, ...existing.map((p) => p.previewPort)) + 1;
    while ([this.config.runtimePort, 22222, 2280, 33333].includes(previewPort)) previewPort++;
    if (previewPort > 65535) throw new Error("No preview ports available");
    const id = randomUUID();
    const project: ProjectRow = {
      id, environmentId, name: body.name ?? (body.repoUrl ? deriveNameFromRepo(body.repoUrl) : "Untitled project"),
      repoUrl: body.repoUrl ?? null, repoBranch: body.repoBranch ?? null,
      path: join(dirname(this.config.workspacePath), "projects", id),
      previewPort, status: "creating", errorMessage: null, createdAt: nowIso(),
    };
    this.db.insert(projects).values(project).run();
    void this.provisionProject(env.sandboxId, project).catch((err) => {
      this.db.update(projects).set({ status: "error", errorMessage: err instanceof Error ? err.message : String(err) }).where(eq(projects.id, id)).run();
    });
    return project;
  }

  private async provisionProject(sandboxId: string, project: ProjectRow): Promise<void> {
    const sandbox = await this.sandboxes.get(sandboxId);
    if (project.repoUrl) {
      await this.sandboxes.cloneRepository(sandbox, { repoUrl: project.repoUrl, branch: project.repoBranch ?? undefined, path: project.path });
    } else {
      await this.sandboxes.initEmptyWorkspace(sandbox, project.path);
    }
    await this.sandboxes.configureWebPreview(sandbox, project.previewPort);
    this.db.update(projects).set({ status: "ready" }).where(eq(projects.id, project.id)).run();
  }

  async listProjectSessions(userId: string, environmentId: string, projectId: string) {
    const project = this.getProject(userId, environmentId, projectId);
    const refs = this.db.select().from(sessions).where(and(
      eq(sessions.environmentId, environmentId),
      projectId === "default" ? isNull(sessions.projectId) : eq(sessions.projectId, projectId),
    )).orderBy(desc(sessions.lastActiveAt), desc(sessions.createdAt)).all();
    if (project.status !== "ready") return refs.map((ref) => ({ ...ref, running: false }));
    const response = await this.openSessionOrRecover(
      userId,
      environmentId,
      "list",
      () => this.proxyRuntime(userId, environmentId, projectRuntimePath("/sessions", project), { method: "GET" }),
    );
    if (!response.ok) throw new Error("Unable to load conversations");
    const runtime = await response.json() as { sessions: { id: string; title?: string | null; running?: boolean; messageCount?: number }[] };
    return refs.map((ref) => {
      const live = runtime.sessions.find((session) => session.id === ref.piSessionId);
      return { ...ref, title: live?.title ?? ref.title ?? "New chat", running: live?.running ?? false, messageCount: live?.messageCount ?? 0 };
    });
  }

  async createSession(userId: string, environmentId: string, title?: string, projectId = "default") {
    SessionRequestSchema.parse({ title });
    this.requireOwned(userId, environmentId);
    const env = this.requireRow(environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    if (env.status !== "ready") throw new Error(`Environment is ${env.status}`);
    const project = this.getProject(userId, environmentId, projectId);
    if (project.status !== "ready") throw new Error(`Project is ${project.status}`);

    const sandbox = await this.sandboxes.get(env.sandboxId);
    const create = () => this.sandboxes.fetchRuntime(sandbox, projectRuntimePath("/sessions", project), {
      method: "POST",
      body: JSON.stringify({ title }),
      runtimeAccessToken: this.config.runtimeAccessSecret,
    });
    let res = await this.openSessionOrRecover(userId, environmentId, "create", create);
    if (!res.ok) {
      throw new Error(
        `Runtime create session failed: ${res.status} ${await res.text()}`,
      );
    }
    const data = (await res.json()) as { id: string };

    const sessionId = randomUUID();
    const createdAt = nowIso();
    this.db
      .insert(sessions)
      .values({
        id: sessionId,
        environmentId,
        projectId: projectId === "default" ? null : projectId,
        piSessionId: data.id,
        title: title ?? null,
        createdAt,
        lastActiveAt: createdAt,
      })
      .run();

    return {
      id: sessionId,
      environmentId,
      projectId,
      piSessionId: data.id,
      title: title ?? null,
      createdAt,
      lastActiveAt: createdAt,
    };
  }

  async getRuntimeConnection(userId: string, environmentId: string) {
    const env = this.requireOwned(userId, environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    if (env.status !== "ready") throw new Error(`Environment is ${env.status}`);

    const sandbox = await this.sandboxes.get(env.sandboxId);
    const preview = await this.sandboxes.getRuntimePreviewUrl(sandbox);
    const wsBase = preview.url.replace(/^http/, "ws");

    return {
      httpBaseUrl: preview.url,
      wsBaseUrl: wsBase,
      note: "Prefer /ui chat + short-lived UI tokens. Do not expose Daytona API keys to the browser.",
    };
  }

  /**
   * Create a Pi session (if needed) and mint a browser UI token.
   * The browser connects via control-plane WS proxy using only this token.
   */
  async openUiChat(
    userId: string,
    environmentId: string,
    opts?: { title?: string; piSessionId?: string; projectId?: string; sessionId?: string },
  ) {
    const env = this.requireOwned(userId, environmentId);
    if (env.status !== "ready" && env.status !== "sleeping")
      throw new Error(`Environment is ${env.status}`);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    const sandbox = await this.sandboxes.get(env.sandboxId);
    if (sandbox.state === "stopped" || sandbox.state === "archived") {
      await this.start(userId, environmentId);
    } else if (sandbox.state !== "started") {
      throw new Error(`Sandbox is ${sandbox.state}`);
    }

    const projectId = opts?.projectId ?? "default";
    const project = this.getProject(userId, environmentId, projectId);
    if (project.status !== "ready") throw new Error(`Project is ${project.status}`);

    let piSessionId = opts?.piSessionId;
    let title = opts?.title;
    let sessionRefId: string | null = null;
    if (opts?.sessionId) {
      const ref = this.db.select().from(sessions).where(and(
        eq(sessions.id, opts.sessionId), eq(sessions.environmentId, environmentId),
        projectId === "default" ? isNull(sessions.projectId) : eq(sessions.projectId, projectId),
      )).get();
      if (!ref) throw new Error("Conversation not found in this project");
      piSessionId = ref.piSessionId;
      title ??= ref.title ?? undefined;
      sessionRefId = ref.id;
    } else if (piSessionId) {
      const ref = this.db.select().from(sessions).where(and(eq(sessions.environmentId, environmentId), eq(sessions.piSessionId, piSessionId))).get();
      if (ref && (ref.projectId ?? "default") !== projectId) throw new Error("Conversation belongs to another project");
      sessionRefId = ref?.id ?? null;
      title ??= ref?.title ?? undefined;
    }

    if (!piSessionId) {
      const session = await this.createSession(
        userId,
        environmentId,
        title,
        projectId,
      );
      piSessionId = session.piSessionId;
      sessionRefId = session.id;
    }

    const openSession = (id: string) =>
      this.proxyRuntime(
        userId,
        environmentId,
        projectRuntimePath(`/sessions/${encodeURIComponent(id)}/open`, project),
        { method: "POST", body: "{}" },
      );

    let opened = await this.openSessionOrRecover(userId, environmentId, piSessionId!, () => openSession(piSessionId!));
    if (!opened.ok) {
      // Pi does not persist empty sessions until the first message is sent.
      if (opened.status === 404 && (opts?.piSessionId || opts?.sessionId || sessionRefId)) {
        const session = await this.createSession(
          userId,
          environmentId,
          title,
          projectId,
        );
        piSessionId = session.piSessionId;
        if (sessionRefId) {
          // Empty Pi sessions are recreated after a restart; keep the user's conversation entry.
          this.db.delete(sessions).where(eq(sessions.id, session.id)).run();
          this.db.update(sessions).set({ piSessionId }).where(eq(sessions.id, sessionRefId)).run();
        } else {
          sessionRefId = session.id;
        }
        opened = await this.openSessionOrRecover(userId, environmentId, session.piSessionId, () => openSession(session.piSessionId));
      }
      if (!opened.ok) throw new Error("Unable to open the agent conversation");
    }

    if (sessionRefId) this.db.update(sessions).set({ lastActiveAt: nowIso() }).where(eq(sessions.id, sessionRefId)).run();

    const minted = mintUiToken({
      userId,
      environmentId,
      piSessionId,
      projectId,
      secret: this.config.browserSessionSecret,
    });

    return {
      environmentId,
      environmentName: env.name,
      projectId,
      projectName: project.name,
      sessionRefId,
      piSessionId,
      token: minted.token,
      expiresAt: minted.expiresAt,
      uiPath: `/ui/?t=${encodeURIComponent(minted.token)}`,
    };
  }

  async resumeUiChat(userId: string, environmentId: string, projectId?: string) {
    this.requireOwned(userId, environmentId);
    const latest = this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.environmentId, environmentId), projectId === undefined ? undefined : projectId === "default" ? isNull(sessions.projectId) : eq(sessions.projectId, projectId)))
      .orderBy(desc(sessions.lastActiveAt), desc(sessions.createdAt))
      .get();
    return this.openUiChat(userId, environmentId, {
      sessionId: latest?.id,
      projectId: projectId ?? latest?.projectId ?? "default",
    });
  }

  async getUiBootstrap(token: string) {
    const payload = verifyUiToken(token, this.config.browserSessionSecret);
    if (!payload) throw new Error("invalid or expired UI token");

    const env = this.requireOwned(payload.userId, payload.environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    const projectId = payload.projectId ?? "default";
    let project = this.getProject(payload.userId, env.id, projectId);
    let piSessionId = payload.piSessionId;
    let replacementToken: string | undefined;
    const loadHistory = (id: string) => this.openSessionOrRecover(
      payload.userId,
      env.id,
      id,
      async () => {
        const current = await this.sandboxes.get(env.sandboxId!);
        project = this.getProject(payload.userId, env.id, projectId);
        await this.sandboxes.configureWebPreview(current, project.previewPort);
        return this.proxyRuntime(
          payload.userId,
          env.id,
          projectRuntimePath(`/sessions/${encodeURIComponent(id)}`, project),
          { method: "GET" },
        );
      },
    );
    let history = await loadHistory(piSessionId);
    if (!history.ok) {
      const opened = await this.openUiChat(payload.userId, env.id, {
        piSessionId,
        projectId,
      });
      piSessionId = opened.piSessionId;
      if (opened.piSessionId !== payload.piSessionId) replacementToken = opened.token;
      project = this.getProject(payload.userId, env.id, opened.projectId);
      history = await loadHistory(piSessionId);
    }
    if (!history.ok) throw new Error("Unable to load conversation");
    const data = (await history.json()) as { messages: unknown[] };
    const health = await this.proxyRuntime(payload.userId, env.id, "/health", {
      method: "GET",
    });
    if (!health.ok) throw new Error("Unable to connect to the agent runtime");
    const runtime = (await health.json()) as {
      model: string;
      provider: string;
    };
    return {
      messages: data.messages,
      environmentId: env.id,
      environmentName: env.name,
      projectId: project.id,
      projectName: project.name,
      previewPort: project.previewPort,
      status: env.status,
      repoUrl: project.repoUrl,
      piSessionId,
      model: runtime.model,
      provider: runtime.provider,
      ...(replacementToken ? { token: replacementToken } : {}),
    };
  }

  /** Open a WebSocket to the in-sandbox Pi runtime for a session. */
  async openRuntimeSessionSocket(
    userId: string,
    environmentId: string,
    piSessionId: string,
    projectId = "default",
  ) {
    const env = this.requireOwned(userId, environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    if (env.status !== "ready") throw new Error(`Environment is ${env.status}`);
    const project = this.getProject(userId, environmentId, projectId);
    if (project.status !== "ready") throw new Error(`Project is ${project.status}`);

    const connect = async () => {
      const sandbox = await this.sandboxes.get(env.sandboxId!);
      return this.sandboxes.connectRuntimeSessionWs(sandbox, {
        piSessionId,
        projectId,
        previewPort: project.previewPort,
        runtimeAccessToken: this.config.runtimeAccessSecret,
      });
    };
    try {
      return await connect();
    } catch {
      await this.recoverRuntime(userId, environmentId);
      return await connect();
    }
  }

  async createPreview(userId: string, environmentId: string, rawBody: unknown) {
    const body = PreviewRequestSchema.parse(rawBody);
    const env = this.requireOwned(userId, environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");

    const sandbox = await this.sandboxes.get(env.sandboxId);
    return this.sandboxes.getSignedPreview(
      sandbox,
      body.port,
      body.expiresInSeconds,
    );
  }

  async proxyRuntime(
    userId: string,
    environmentId: string,
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const env = this.requireOwned(userId, environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    if (env.status !== "ready") throw new Error(`Environment is ${env.status}`);

    const sandbox = await this.sandboxes.get(env.sandboxId);
    return this.sandboxes.fetchRuntime(sandbox, path, {
      ...init,
      runtimeAccessToken: this.config.runtimeAccessSecret,
    });
  }

  private async missingPiSession(response: Response, sessionId: string): Promise<boolean> {
    if (response.status !== 404) return false;
    const body = await response.clone().json().catch(() => null) as { error?: string } | null;
    return typeof body?.error === "string" && body.error.includes(`Session not found: ${sessionId}`);
  }

  private async openSessionOrRecover(
    userId: string,
    environmentId: string,
    sessionId: string,
    request: () => Promise<Response>,
  ): Promise<Response> {
    try {
      const response = await request();
      if (response.ok || await this.missingPiSession(response, sessionId)) return response;
      await this.recoverRuntime(userId, environmentId);
      return await request();
    } catch {
      await this.recoverRuntime(userId, environmentId);
      return await request();
    }
  }

  private async recoverRuntime(userId: string, environmentId: string): Promise<void> {
    const env = this.requireOwned(userId, environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    const sandbox = await this.sandboxes.get(env.sandboxId);
    if (sandbox.state === "stopped" || sandbox.state === "archived") {
      if (env.status === "sleeping") throw new Error("Environment is sleeping");
      await this.start(userId, environmentId);
      return;
    }
    if (sandbox.state !== "started") throw new Error(`Sandbox is ${sandbox.state}`);
    let processUp = false;
    try {
      await this.sandboxes.waitForRuntimeHealthy(sandbox, 5_000);
      processUp = true;
    } catch {
      // Process is not answering on the runtime port.
    }
    let reachable = false;
    if (processUp) {
      try {
        // /health is unauthenticated; /environment proves the access token still matches.
        const probe = await this.sandboxes.fetchRuntime(sandbox, "/environment", {
          method: "GET",
          runtimeAccessToken: this.config.runtimeAccessSecret,
        });
        reachable = probe.ok;
      } catch {
        // Preview or auth failed even though curl health succeeded.
      }
    }
    if (processUp && reachable) return;
    const bundleDir = resolveRuntimeBundle(this.config.runtimeBundleDir);
    await this.sandboxes.deployAndStartRuntime(sandbox, {
      runtimeBundleLocalDir: bundleDir,
      runtimeAccessToken: this.config.runtimeAccessSecret,
      modelEnv: buildSandboxModelEnv(process.env),
    });
  }

  private async setStatus(
    id: string,
    status: EnvironmentStatus,
    errorMessage?: string,
  ): Promise<void> {
    this.db
      .update(environments)
      .set({
        status,
        errorMessage: errorMessage ?? null,
        updatedAt: nowIso(),
        ...(status === "ready" ? { lastActiveAt: nowIso() } : {}),
      })
      .where(eq(environments.id, id))
      .run();
  }

  private requireRow(id: string): EnvironmentRow {
    const row = this.db
      .select()
      .from(environments)
      .where(eq(environments.id, id))
      .get();
    if (!row) throw new Error(`Environment not found: ${id}`);
    return row;
  }

  private requireOwned(userId: string, id: string): EnvironmentRow {
    const row = this.requireRow(id);
    if (row.userId !== userId) throw new Error("forbidden");
    if (row.status === "deleted") throw new Error("Environment deleted");
    return row;
  }
}

function deriveNameFromRepo(repoUrl: string): string {
  try {
    const u = new URL(repoUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "project";
    return last.replace(/\.git$/, "");
  } catch {
    return "project";
  }
}

function projectRuntimePath(path: string, project: ProjectRow): string {
  if (project.id === "default") return path;
  return `${path}?${new URLSearchParams({ projectId: project.id, previewPort: String(project.previewPort) })}`;
}

function resolveRuntimeBundle(configured: string): string {
  const candidates = [
    resolve(configured, "deploy"),
    configured,
    resolve(configured, "dist"),
  ];

  for (const dir of candidates) {
    if (
      existsSync(resolve(dir, "package.json")) &&
      existsSync(resolve(dir, "server.js"))
    ) {
      return dir;
    }
    if (
      existsSync(resolve(dir, "package.json")) &&
      existsSync(resolve(dir, "dist/server.js"))
    ) {
      return dir;
    }
  }

  throw new Error(
    `Runtime deploy bundle not found under ${configured}. Run: pnpm --filter @cloud-agent/sandbox-runtime build`,
  );
}
