import {
  Daytona,
  type Sandbox,
  Image,
} from "@daytona/sdk";
import {
  DEFAULT_PI_AGENT_DIR,
  DEFAULT_RUNTIME_PORT,
  DEFAULT_WORKSPACE_PATH,
} from "@cloud-agent/protocol";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import WebSocket from "ws";

export type DaytonaClientConfig = {
  apiKey: string;
  apiUrl?: string;
  target?: string;
  /** Pre-built snapshot name. Prefer this in production. */
  snapshot?: string;
  runtimePort?: number;
  workspacePath?: string;
  piAgentDir?: string;
};

export type CreateSandboxOptions = {
  name: string;
  envVars?: Record<string, string>;
  labels?: Record<string, string>;
  autoStopInterval?: number;
};

export type CloneRepoOptions = {
  repoUrl: string;
  branch?: string;
  path?: string;
};

export type SignedPreview = {
  url: string;
  token?: string;
  port: number;
  expiresInSeconds: number;
};

const RUNTIME_SESSION_ID = "sandbox-runtime";

/**
 * Thin wrapper around @daytona/sdk for environment lifecycle.
 * Pi conversation state stays inside the sandbox; this client only orchestrates compute.
 */
export class SandboxClient {
  readonly daytona: Daytona;
  readonly runtimePort: number;
  readonly workspacePath: string;
  readonly piAgentDir: string;
  readonly snapshot?: string;

  constructor(config: DaytonaClientConfig) {
    this.daytona = new Daytona({
      apiKey: config.apiKey,
      ...(config.apiUrl ? { apiUrl: config.apiUrl } : {}),
      ...(config.target ? { target: config.target } : {}),
    });
    this.runtimePort = config.runtimePort ?? DEFAULT_RUNTIME_PORT;
    this.workspacePath = config.workspacePath ?? DEFAULT_WORKSPACE_PATH;
    this.piAgentDir = config.piAgentDir ?? DEFAULT_PI_AGENT_DIR;
    this.snapshot = config.snapshot;
  }

  async create(options: CreateSandboxOptions): Promise<Sandbox> {
    const envVars = {
      WORKSPACE_PATH: this.workspacePath,
      PI_AGENT_DIR: this.piAgentDir,
      RUNTIME_PORT: String(this.runtimePort),
      ...options.envVars,
    };

    if (this.snapshot) {
      return this.daytona.create(
        {
          name: options.name,
          snapshot: this.snapshot,
          language: "typescript",
          envVars,
          labels: options.labels,
          autoStopInterval: options.autoStopInterval ?? 60,
          public: false,
        },
        { timeout: 180 },
      );
    }

    // MVP fallback: create from a Node image and install runtime deps on first boot.
    // Prefer DAYTONA_SNAPSHOT in production so this install step is skipped.
    return this.daytona.create(
      {
        name: options.name,
        image: Image.base("node:22-bookworm"),
        language: "typescript",
        envVars,
        labels: options.labels,
        autoStopInterval: options.autoStopInterval ?? 60,
        public: false,
        resources: {
          cpu: 2,
          memory: 4,
          disk: 10,
        },
      },
      { timeout: 300 },
    );
  }

  async get(sandboxId: string): Promise<Sandbox> {
    return this.daytona.get(sandboxId);
  }

  async start(sandboxId: string, timeoutSeconds = 120): Promise<Sandbox> {
    const sandbox = await this.get(sandboxId);
    await sandbox.start(timeoutSeconds);
    return sandbox;
  }

  async stop(sandboxId: string, timeoutSeconds = 60): Promise<void> {
    const sandbox = await this.get(sandboxId);
    await sandbox.stop(timeoutSeconds);
  }

  async delete(sandboxId: string): Promise<void> {
    const sandbox = await this.get(sandboxId);
    await sandbox.delete(60, true);
  }

  async ensureWorkspace(sandbox: Sandbox): Promise<void> {
    await sandbox.process.executeCommand(
      `mkdir -p "${this.workspacePath}" "${this.piAgentDir}/sessions"`,
      undefined,
      undefined,
      60,
    );
  }

  async cloneRepository(sandbox: Sandbox, options: CloneRepoOptions): Promise<void> {
    const target = options.path ?? this.workspacePath;
    await sandbox.process.executeCommand(
      `mkdir -p "$(dirname "${target}")" && rm -rf "${target}"`,
      undefined,
      undefined,
      60,
    );

    await sandbox.git.clone(
      options.repoUrl,
      target,
      options.branch,
      undefined,
      undefined,
      undefined,
      false,
      1,
    );
  }

  async initEmptyWorkspace(sandbox: Sandbox): Promise<void> {
    await this.ensureWorkspace(sandbox);
    await sandbox.process.executeCommand(
      [
        `mkdir -p "${this.workspacePath}"`,
        `cd "${this.workspacePath}"`,
        `if [ ! -d .git ]; then git init -b main; fi`,
        `if [ ! -f README.md ]; then echo "# Workspace" > README.md; fi`,
      ].join(" && "),
      undefined,
      undefined,
      60,
    );
  }

  /**
   * Upload local runtime bundle + install dependencies inside the sandbox,
   * then start the long-lived runtime process.
   */
  async deployAndStartRuntime(
    sandbox: Sandbox,
    options: {
      runtimeBundleLocalDir: string;
      runtimeAccessToken: string;
      modelEnv: Record<string, string>;
      runtimeEntry?: string;
    },
  ): Promise<void> {
    const remoteRuntimeDir = "/home/daytona/sandbox-runtime";

    await sandbox.process.executeCommand(
      `rm -rf "${remoteRuntimeDir}" && mkdir -p "${remoteRuntimeDir}"`,
      undefined,
      undefined,
      60,
    );

    await uploadDirectory(sandbox, options.runtimeBundleLocalDir, remoteRuntimeDir);

    const install = await sandbox.process.executeCommand(
      `cd "${remoteRuntimeDir}" && npm install --omit=dev --ignore-scripts`,
      undefined,
      undefined,
      300,
    );
    if (install.exitCode !== 0) {
      throw new Error(`Runtime install failed: ${install.result}`);
    }

    // Recreate runtime session if present.
    try {
      await sandbox.process.deleteSession(RUNTIME_SESSION_ID);
    } catch {
      // ignore missing session
    }
    await sandbox.process.createSession(RUNTIME_SESSION_ID);

    const envExports = Object.entries({
      ...options.modelEnv,
      RUNTIME_PORT: String(this.runtimePort),
      WORKSPACE_PATH: this.workspacePath,
      PI_AGENT_DIR: this.piAgentDir,
      RUNTIME_ACCESS_TOKEN: options.runtimeAccessToken,
      NODE_ENV: "production",
    })
      .filter(([, v]) => Boolean(v))
      .map(([k, v]) => `export ${k}=${shellQuote(v)}`)
      .join(" && ");

    const entry = options.runtimeEntry ?? "server.js";
    await sandbox.process.executeSessionCommand(RUNTIME_SESSION_ID, {
      command: `${envExports} && cd ${shellQuote(remoteRuntimeDir)} && node ${shellQuote(entry)}`,
      runAsync: true,
    });

    await this.waitForRuntimeHealthy(sandbox, 90_000);
  }

  async waitForRuntimeHealthy(sandbox: Sandbox, timeoutMs = 60_000): Promise<void> {
    const started = Date.now();
    let lastError = "timeout";

    while (Date.now() - started < timeoutMs) {
      try {
        const res = await sandbox.process.executeCommand(
          `curl -sf http://127.0.0.1:${this.runtimePort}/health`,
          undefined,
          undefined,
          10,
        );
        if (res.exitCode === 0) return;
        lastError = res.result || `exit ${res.exitCode}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await sleep(1500);
    }

    throw new Error(`Sandbox runtime did not become healthy: ${lastError}`);
  }

  async getRuntimePreviewUrl(sandbox: Sandbox): Promise<SignedPreview> {
    return this.getSignedPreview(sandbox, this.runtimePort, 3600);
  }

  async getSignedPreview(
    sandbox: Sandbox,
    port: number,
    expiresInSeconds = 3600,
  ): Promise<SignedPreview> {
    const signed = await sandbox.getSignedPreviewUrl(port, expiresInSeconds);
    return {
      url: signed.url,
      token: signed.token,
      port,
      expiresInSeconds,
    };
  }

  /**
   * Proxy an HTTP request into the sandbox runtime via Daytona preview.
   * Control plane uses this so browsers never hold sandbox credentials.
   */
  async fetchRuntime(
    sandbox: Sandbox,
    path: string,
    init: RequestInit & { runtimeAccessToken: string },
  ): Promise<Response> {
    const preview = await sandbox.getPreviewLink(this.runtimePort);
    const url = new URL(path, preview.url.endsWith("/") ? preview.url : `${preview.url}/`);

    const headers = new Headers(init.headers);
    headers.set("x-daytona-preview-token", preview.token);
    headers.set("authorization", `Bearer ${init.runtimeAccessToken}`);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const { runtimeAccessToken: _, ...rest } = init;
    return fetch(url, { ...rest, headers });
  }

  /**
   * Open a WebSocket to a Pi session inside the sandbox runtime.
   * Used by the control-plane UI proxy (browser never holds these credentials).
   */
  async connectRuntimeSessionWs(
    sandbox: Sandbox,
    options: { piSessionId: string; runtimeAccessToken: string },
  ): Promise<WebSocket> {
    const preview = await sandbox.getPreviewLink(this.runtimePort);
    const httpBase = preview.url.endsWith("/") ? preview.url : `${preview.url}/`;
    const wsBase = httpBase.replace(/^http/i, "ws");
    const url = new URL(
      `ws/sessions/${encodeURIComponent(options.piSessionId)}`,
      wsBase,
    );
    url.searchParams.set("token", options.runtimeAccessToken);

    return await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          "x-daytona-preview-token": preview.token,
        },
      });
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onOpen = () => {
        cleanup();
        resolve(ws);
      };
      const cleanup = () => {
        ws.off("open", onOpen);
        ws.off("error", onError);
      };
      ws.once("open", onOpen);
      ws.once("error", onError);
    });
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadDirectory(
  sandbox: Sandbox,
  localDir: string,
  remoteDir: string,
): Promise<void> {
  await sandbox.fs.createFolder(remoteDir, "755");
  const files: Array<{ source: string; destination: string }> = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = join(current, entry.name);
      const rel = relative(localDir, full);
      const remotePath = join(remoteDir, rel).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        await sandbox.fs.createFolder(remotePath, "755");
        await walk(full);
      } else if (entry.isFile()) {
        const info = await stat(full);
        if (info.size === 0) {
          // Daytona may reject empty files in some uploads; write via shell instead.
          await sandbox.process.executeCommand(
            `mkdir -p "$(dirname "${remotePath}")" && : > "${remotePath}"`,
          );
        } else {
          files.push({ source: full, destination: remotePath });
        }
      }
    }
  }

  await walk(localDir);

  const chunkSize = 40;
  for (let i = 0; i < files.length; i += chunkSize) {
    await sandbox.fs.uploadFiles(files.slice(i, i + chunkSize), 600);
  }
}

export function createSandboxClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SandboxClient {
  const apiKey = env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is required");
  }

  return new SandboxClient({
    apiKey,
    apiUrl: env.DAYTONA_API_URL,
    target: env.DAYTONA_TARGET,
    snapshot: env.DAYTONA_SNAPSHOT || undefined,
    runtimePort: env.RUNTIME_PORT ? Number(env.RUNTIME_PORT) : undefined,
    workspacePath: env.WORKSPACE_PATH,
    piAgentDir: env.PI_AGENT_DIR,
  });
}
