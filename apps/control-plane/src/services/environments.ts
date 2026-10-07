import { randomUUID } from "node:crypto";
import { eq, and, ne, desc } from "drizzle-orm";
import {
  createDatabase,
  migrateDatabase,
  environments,
  sessions,
  users,
  type AppDatabase,
  type EnvironmentRow,
} from "@cloud-agent/database";
import {
  CreateEnvironmentRequestSchema,
  PreviewRequestSchema,
  buildSandboxModelEnv,
  type EnvironmentStatus,
} from "@cloud-agent/protocol";
import {
  createSandboxClientFromEnv,
  type SandboxClient,
} from "@cloud-agent/sandbox-client";
import type { AppConfig } from "../config.js";
import { mintUiToken, verifyUiToken } from "../ui-tokens.js";
import { resolve } from "node:path";
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
      } catch {
        const bundleDir = resolveRuntimeBundle(this.config.runtimeBundleDir);
        await this.sandboxes.deployAndStartRuntime(sandbox, {
          runtimeBundleLocalDir: bundleDir,
          runtimeAccessToken: this.config.runtimeAccessSecret,
          modelEnv: buildSandboxModelEnv(process.env),
        });
      }
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

  async createSession(userId: string, environmentId: string, title?: string) {
    this.requireOwned(userId, environmentId);
    const env = this.requireRow(environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    if (env.status !== "ready") throw new Error(`Environment is ${env.status}`);

    const sandbox = await this.sandboxes.get(env.sandboxId);
    const res = await this.sandboxes.fetchRuntime(sandbox, "/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
      runtimeAccessToken: this.config.runtimeAccessSecret,
    });
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
        piSessionId: data.id,
        title: title ?? null,
        createdAt,
        lastActiveAt: createdAt,
      })
      .run();

    return {
      id: sessionId,
      environmentId,
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
    opts?: { title?: string; piSessionId?: string },
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

    let piSessionId = opts?.piSessionId;
    let sessionRefId: string | null = null;

    if (!piSessionId) {
      const session = await this.createSession(
        userId,
        environmentId,
        opts?.title ?? env.name,
      );
      piSessionId = session.piSessionId;
      sessionRefId = session.id;
    }

    // Ensure session is open in the runtime before handing a UI link.
    let opened = await this.proxyRuntime(
      userId,
      environmentId,
      `/sessions/${encodeURIComponent(piSessionId)}/open`,
      { method: "POST", body: "{}" },
    );
    if (!opened.ok) {
      // Pi does not persist empty sessions until the first message is sent.
      if (opened.status === 404 && opts?.piSessionId) {
        const error = (await opened.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (error?.error === `Session not found: ${piSessionId}`) {
          const session = await this.createSession(
            userId,
            environmentId,
            opts.title ?? env.name,
          );
          piSessionId = session.piSessionId;
          sessionRefId = session.id;
          opened = await this.proxyRuntime(
            userId,
            environmentId,
            `/sessions/${encodeURIComponent(piSessionId)}/open`,
            { method: "POST", body: "{}" },
          );
        }
      }
      if (!opened.ok) throw new Error("Unable to open the agent conversation");
    }

    const minted = mintUiToken({
      userId,
      environmentId,
      piSessionId,
      secret: this.config.browserSessionSecret,
    });

    return {
      environmentId,
      environmentName: env.name,
      sessionRefId,
      piSessionId,
      token: minted.token,
      expiresAt: minted.expiresAt,
      uiPath: `/ui/?t=${encodeURIComponent(minted.token)}`,
    };
  }

  async resumeUiChat(userId: string, environmentId: string) {
    this.requireOwned(userId, environmentId);
    const latest = this.db
      .select()
      .from(sessions)
      .where(eq(sessions.environmentId, environmentId))
      .orderBy(desc(sessions.createdAt))
      .get();
    return this.openUiChat(userId, environmentId, {
      piSessionId: latest?.piSessionId,
    });
  }

  async getUiBootstrap(token: string) {
    const payload = verifyUiToken(token, this.config.browserSessionSecret);
    if (!payload) throw new Error("invalid or expired UI token");

    const env = this.requireOwned(payload.userId, payload.environmentId);
    const history = await this.proxyRuntime(
      payload.userId,
      env.id,
      `/sessions/${encodeURIComponent(payload.piSessionId)}`,
      { method: "GET" },
    );
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
      status: env.status,
      repoUrl: env.repoUrl,
      piSessionId: payload.piSessionId,
      model: runtime.model,
      provider: runtime.provider,
    };
  }

  /** Open a WebSocket to the in-sandbox Pi runtime for a session. */
  async openRuntimeSessionSocket(
    userId: string,
    environmentId: string,
    piSessionId: string,
  ) {
    const env = this.requireOwned(userId, environmentId);
    if (!env.sandboxId) throw new Error("Environment has no sandbox");
    if (env.status !== "ready") throw new Error(`Environment is ${env.status}`);

    const sandbox = await this.sandboxes.get(env.sandboxId);
    return this.sandboxes.connectRuntimeSessionWs(sandbox, {
      piSessionId,
      runtimeAccessToken: this.config.runtimeAccessSecret,
    });
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
